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

    if (!message || message.trim() === '') {
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

    // Don't allow messages on resolved tickets
    if (ticket.status === 'Resolved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot send messages on resolved tickets'
      });
    }

    const newMessage = await Message.create({
      ticket: ticketId,
      sender: req.user.id,
      message: message.trim()
    });

    await newMessage.populate('sender', 'name email role avatar');

    // If agent is replying, update ticket status
    if (req.user.role === 'agent' && ticket.status === 'Assigned') {
      ticket.status = 'In Progress';
      await ticket.save();
    }

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