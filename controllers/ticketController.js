import Ticket from '../models/Ticket.js';
import User from '../models/User.js';
import { generateTicketNumber } from '../utils/generateTicketNumber.js';

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
    if (category) ticket.category = category;
    if (priority) ticket.priority = priority;
    if (status) {
      // Validate status transition
      if (status === 'Resolved' && !req.body.resolutionNote) {
        return res.status(400).json({
          success: false,
          message: 'Resolution note is required to resolve this ticket'
        });
      }
      ticket.status = status;
      if (status === 'Resolved') {
        ticket.resolvedAt = new Date();
      }
    }

    await ticket.save();
    await ticket.populate('customer', 'name email');
    await ticket.populate('assignedAgent', 'name email');

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