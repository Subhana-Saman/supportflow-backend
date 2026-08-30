import Ticket from '../models/Ticket.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';

const setupSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (!user || !user.isActive) {
        return next(new Error('User not found or inactive'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.user.email} (${socket.user.role})`);

    // Join ticket room
    socket.on('joinTicket', async (ticketId) => {
      try {
        const ticket = await Ticket.findById(ticketId);
        if (!ticket) {
          return socket.emit('error', { message: 'Ticket not found' });
        }

        // Verify authorization
        const userId = socket.user._id.toString();
        const isCustomer = ticket.customer.toString() === userId;
        const isAgent = ticket.assignedAgent && ticket.assignedAgent.toString() === userId;
        const isAdmin = socket.user.role === 'admin';

        if (!isCustomer && !isAgent && !isAdmin) {
          return socket.emit('error', { message: 'Access denied' });
        }

        socket.join(`ticket:${ticketId}`);
        socket.emit('joinedTicket', { ticketId });
        console.log(`📋 ${socket.user.email} joined ticket: ${ticketId}`);
      } catch (error) {
        socket.emit('error', { message: 'Failed to join ticket' });
      }
    });

    // Leave ticket room
    socket.on('leaveTicket', (ticketId) => {
      socket.leave(`ticket:${ticketId}`);
      console.log(`📋 ${socket.user.email} left ticket: ${ticketId}`);
    });

    // Send message
    socket.on('newMessage', async (data) => {
      try {
        const { ticketId, message } = data;
        
        if (!message || message.trim() === '') {
          return socket.emit('error', { message: 'Message cannot be empty' });
        }

        const ticket = await Ticket.findById(ticketId);
        if (!ticket) {
          return socket.emit('error', { message: 'Ticket not found' });
        }

        // Verify authorization
        const userId = socket.user._id.toString();
        const isCustomer = ticket.customer.toString() === userId;
        const isAgent = ticket.assignedAgent && ticket.assignedAgent.toString() === userId;
        const isAdmin = socket.user.role === 'admin';

        if (!isCustomer && !isAgent && !isAdmin) {
          return socket.emit('error', { message: 'Access denied' });
        }

        if (ticket.status === 'Resolved') {
          return socket.emit('error', { message: 'Cannot send messages on resolved tickets' });
        }

        // Create message
        const Message = (await import('../models/Message.js')).default;
        const newMessage = await Message.create({
          ticket: ticketId,
          sender: socket.user._id,
          message: message.trim()
        });

        await newMessage.populate('sender', 'name email role avatar');

        // If agent is replying, update ticket status
        if (socket.user.role === 'agent' && ticket.status === 'Assigned') {
          ticket.status = 'In Progress';
          await ticket.save();
        }

        // Emit to room
        io.to(`ticket:${ticketId}`).emit('messageReceived', {
          message: newMessage,
          ticketId
        });

        console.log(`💬 Message sent in ticket ${ticketId} by ${socket.user.email}`);
      } catch (error) {
        console.error('Message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing', (data) => {
      const { ticketId, isTyping } = data;
      socket.to(`ticket:${ticketId}`).emit('userTyping', {
        userId: socket.user._id,
        userName: socket.user.name,
        isTyping
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`🔌 User disconnected: ${socket.user.email}`);
    });
  });
};

export default setupSocket;