import Ticket from '../models/Ticket.js';
import User from '../models/User.js';
import TicketActivity from '../models/TicketActivity.js';
import { generateTicketNumber } from '../utils/generateTicketNumber.js';

// Small helper so every action logs a consistent, timestamped activity entry.
const logActivity = async (ticketId, actorId, action, description) => {
  try {
    await TicketActivity.create({ ticket: ticketId, actor: actorId, action, description });
  } catch (err) {
    // Never let a logging failure break the actual ticket action
    console.error('Activity log error:', err);
  }
};

// Broadcasts the updated ticket to everyone currently viewing it (customer +
// assigned agent) so status/category/priority/assignment changes made via
// the REST API show up instantly on the other side, with no page refresh.
const emitTicketUpdate = (req, ticket) => {
  try {
    const io = req.app.get('io');
    if (!io) return;
    io.to(`ticket:${ticket._id}`).emit('ticketStatusUpdated', {
      ticketId: ticket._id,
      ticket
    });
  } catch (err) {
    console.error('Socket emit error (ticketStatusUpdated):', err);
  }
};

// @desc    Create ticket
// @route   POST /api/tickets
// @access  Private (Customer)
export const createTicket = async (req, res) => {
  try {
    const { subject, description, category, priority } = req.body;

    // Generate ticket number
    const ticketNumber = await generateTicketNumber();

    const ticket = await Ticket.create({
      ticketNumber,
      customer: req.user.id,
      subject,
      description,
      category: category || 'Other',
      priority: priority || 'Medium',
      status: 'New'
    });

    // Populate customer info
    await ticket.populate('customer', 'name email');

    await logActivity(ticket._id, req.user.id, 'created', `Ticket ${ticket.ticketNumber} created`);

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      data: ticket
    });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create ticket'
    });
  }
};

// @desc    Get all tickets (filtered by role)
// @route   GET /api/tickets
// @access  Private
export const getTickets = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, priority, category, sort = '-createdAt' } = req.query;
    const skip = (page - 1) * limit;

    let query = {};

    // Role-based filtering
    if (req.user.role === 'customer') {
      query.customer = req.user.id;
    } else if (req.user.role === 'agent') {
      query.$or = [
        { assignedAgent: req.user.id },
        { assignedAgent: null, status: 'New' }
      ];
    }
    // Admin sees all

    // Search
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$and = [
        {
          $or: [
            { ticketNumber: { $regex: searchRegex } },
            { subject: { $regex: searchRegex } }
          ]
        }
      ];
    }

    // Filters
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;

    const tickets = await Ticket.find(query)
      .populate('customer', 'name email')
      .populate('assignedAgent', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Ticket.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        tickets,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tickets'
    });
  }
};

// @desc    Get single ticket
// @route   GET /api/tickets/:id
// @access  Private
export const getTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('customer', 'name email avatar')
      .populate('assignedAgent', 'name email avatar');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check authorization
    if (req.user.role === 'customer' && ticket.customer._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (req.user.role === 'agent' && 
        ticket.assignedAgent && 
        ticket.assignedAgent._id.toString() !== req.user.id &&
        req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ticket'
    });
  }
};

// @desc    Update ticket
// @route   PATCH /api/tickets/:id
// @access  Private (Agent/Admin)
export const updateTicket = async (req, res) => {
  try {
    const { category, priority, status } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check authorization
    if (req.user.role === 'agent' && 
        ticket.assignedAgent && 
        ticket.assignedAgent.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Don't allow updates on resolved tickets
    if (ticket.status === 'Resolved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update a resolved ticket'
      });
    }

    // Update fields
    if (category && category !== ticket.category) {
      await logActivity(ticket._id, req.user.id, 'category_changed', `Category changed from ${ticket.category} to ${category}`);
      ticket.category = category;
    }
    if (priority && priority !== ticket.priority) {
      await logActivity(ticket._id, req.user.id, 'priority_changed', `Priority changed from ${ticket.priority} to ${priority}`);
      ticket.priority = priority;
    }
    if (status && status !== ticket.status) {
      // Validate status transition
      if (status === 'Resolved' && !req.body.resolutionNote) {
        return res.status(400).json({
          success: false,
          message: 'Resolution note is required to resolve this ticket'
        });
      }
      await logActivity(ticket._id, req.user.id, 'status_changed', `Status changed from ${ticket.status} to ${status}`);
      ticket.status = status;
      if (status === 'Resolved') {
        ticket.resolvedAt = new Date();
      }
    }

    await ticket.save();
    await ticket.populate('customer', 'name email');
    await ticket.populate('assignedAgent', 'name email');

    emitTicketUpdate(req, ticket);

    res.status(200).json({
      success: true,
      message: 'Ticket updated successfully',
      data: ticket
    });
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ticket'
    });
  }
};

// @desc    Assign ticket to agent
// @route   PATCH /api/tickets/:id/assign
// @access  Private (Agent/Admin)
export const assignTicket = async (req, res) => {
  try {
    const { agentId } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    if (ticket.status === 'Resolved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot assign a resolved ticket'
      });
    }

    // Check if agent exists
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== 'agent') {
      return res.status(400).json({
        success: false,
        message: 'Invalid agent'
      });
    }

    ticket.assignedAgent = agentId;
    if (ticket.status === 'New') {
      ticket.status = 'Assigned';
    }

    await ticket.save();
    await ticket.populate('customer', 'name email');
    await ticket.populate('assignedAgent', 'name email');

    await logActivity(ticket._id, req.user.id, 'assigned', `Ticket assigned to ${ticket.assignedAgent.name}`);

    emitTicketUpdate(req, ticket);

    res.status(200).json({
      success: true,
      message: 'Ticket assigned successfully',
      data: ticket
    });
  } catch (error) {
    console.error('Assign ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign ticket'
    });
  }
};

// @desc    Cancel ticket (customer only, before it's picked up)
// @route   PATCH /api/tickets/:id/cancel
// @access  Private (Customer - owner only)
export const cancelTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Only the customer who owns the ticket can cancel it
    if (ticket.customer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Can only cancel while it's still New (not yet picked up by an agent)
    if (ticket.status !== 'New') {
      return res.status(400).json({
        success: false,
        message: 'Only tickets with status "New" can be cancelled'
      });
    }

    ticket.status = 'Cancelled';
    await ticket.save();
    await ticket.populate('customer', 'name email');
    await ticket.populate('assignedAgent', 'name email');

    await logActivity(ticket._id, req.user.id, 'cancelled', 'Ticket cancelled by customer');

    emitTicketUpdate(req, ticket);

    res.status(200).json({
      success: true,
      message: 'Ticket cancelled successfully',
      data: ticket
    });
  } catch (error) {
    console.error('Cancel ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel ticket'
    });
  }
};

// @desc    Reopen a resolved ticket
// @route   PATCH /api/tickets/:id/reopen
// @access  Private (Customer owner, or Agent/Admin)
export const reopenTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    const isOwner = ticket.customer.toString() === req.user.id;
    const isAssignedAgent = ticket.assignedAgent && ticket.assignedAgent.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAssignedAgent && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (ticket.status !== 'Resolved') {
      return res.status(400).json({
        success: false,
        message: 'Only resolved tickets can be reopened'
      });
    }

    ticket.status = 'In Progress';
    ticket.resolvedAt = null;
    await ticket.save();
    await ticket.populate('customer', 'name email');
    await ticket.populate('assignedAgent', 'name email');

    await logActivity(ticket._id, req.user.id, 'reopened', 'Ticket reopened');

    emitTicketUpdate(req, ticket);

    res.status(200).json({
      success: true,
      message: 'Ticket reopened successfully',
      data: ticket
    });
  } catch (error) {
    console.error('Reopen ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reopen ticket'
    });
  }
};

// @desc    Resolve ticket
// @route   PATCH /api/tickets/:id/resolve
// @access  Private (Agent/Admin)
export const resolveTicket = async (req, res) => {
  try {
    const { resolutionNote } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check authorization
    if (req.user.role === 'agent' && 
        ticket.assignedAgent && 
        ticket.assignedAgent.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (ticket.status === 'Resolved') {
      return res.status(400).json({
        success: false,
        message: 'Ticket is already resolved'
      });
    }

    if (!resolutionNote) {
      return res.status(400).json({
        success: false,
        message: 'Resolution note is required before resolving this ticket'
      });
    }

    ticket.status = 'Resolved';
    ticket.resolutionNote = resolutionNote;
    ticket.resolvedAt = new Date();

    await ticket.save();
    await ticket.populate('customer', 'name email');
    await ticket.populate('assignedAgent', 'name email');

    await logActivity(ticket._id, req.user.id, 'resolved', 'Ticket resolved with a resolution note');

    emitTicketUpdate(req, ticket);

    res.status(200).json({
      success: true,
      message: 'Ticket resolved successfully',
      data: ticket
    });
  } catch (error) {
    console.error('Resolve ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve ticket'
    });
  }
};

// @desc    Get activity timeline for a ticket
// @route   GET /api/tickets/:id/activity
// @access  Private
export const getTicketActivity = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Same authorization rules as viewing the ticket itself
    if (req.user.role === 'customer' && ticket.customer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (req.user.role === 'agent' &&
        ticket.assignedAgent &&
        ticket.assignedAgent.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const activity = await TicketActivity.find({ ticket: req.params.id })
      .populate('actor', 'name role')
      .sort('createdAt');

    res.status(200).json({
      success: true,
      data: activity
    });
  } catch (error) {
    console.error('Get ticket activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ticket activity'
    });
  }
};