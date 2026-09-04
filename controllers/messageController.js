import Message from '../models/Message.js';
import Ticket from '../models/Ticket.js';

// @desc    Get messages for a ticket
// @route   GET /api/tickets/:id/messages
// @access  Private
export const getMessages = async (req, res) => {
  try {
    const ticketId = req.params.id;

    // Check ticket exists and user has access
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check authorization
    if (req.user.role === 'customer' && ticket.customer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (req.user.role === 'agent' && 
        ticket.assignedAgent && 
        ticket.assignedAgent.toString() !== req.user.id &&
        req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const messages = await Message.find({ ticket: ticketId })
      .populate('sender', 'name email role avatar')
      .sort('createdAt');

    res.status(200).json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
};

// @desc    Send message
// @route   POST /api/tickets/:id/messages
// @access  Private
export const sendMessage = async (req, res) => {
  try {
    const { message } = req.body;
    const ticketId = req.params.id;
    const hasFile = !!req.file;

    if ((!message || message.trim() === '') && !hasFile) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty'
      });
    }

    // Check ticket exists and user has access
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check authorization
    if (req.user.role === 'customer' && ticket.customer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (req.user.role === 'agent' && 
        ticket.assignedAgent && 
        ticket.assignedAgent.toString() !== req.user.id &&
        req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Don't allow messages on resolved or cancelled tickets
    if (ticket.status === 'Resolved' || ticket.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: `Cannot send messages on a ${ticket.status.toLowerCase()} ticket`
      });
    }

    const messageData = {
      ticket: ticketId,
      sender: req.user.id,
      message: message ? message.trim() : ''
    };

    // Store the file inline as a base64 data URL so it works the same on
    // serverless hosts (no local disk persistence needed) and stays in Mongo.
    if (hasFile) {
      const base64 = req.file.buffer.toString('base64');
      messageData.attachment = {
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        fileUrl: `data:${req.file.mimetype};base64,${base64}`
      };
    }

    const newMessage = await Message.create(messageData);

    await newMessage.populate('sender', 'name email role avatar');

    // SLA tracking: record the moment an agent first responds to a ticket
    if (req.user.role === 'agent' && !ticket.firstResponseAt) {
      ticket.firstResponseAt = new Date();
    }

    // If agent is replying, update ticket status
    if (req.user.role === 'agent' && ticket.status === 'Assigned') {
      ticket.status = 'In Progress';
    }

    await ticket.save();

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: newMessage
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
};