import Ticket from '../models/Ticket.js';
import User from '../models/User.js';

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
export const getStats = async (req, res) => {
  try {
    let stats = {};
    const userId = req.user.id;
    const role = req.user.role;

    if (role === 'customer') {
      // Customer stats
      const totalTickets = await Ticket.countDocuments({ customer: userId });
      const newTickets = await Ticket.countDocuments({ customer: userId, status: 'New' });
      const inProgressTickets = await Ticket.countDocuments({ customer: userId, status: 'In Progress' });
      const resolvedTickets = await Ticket.countDocuments({ customer: userId, status: 'Resolved' });

      stats = {
        totalTickets,
        newTickets,
        inProgressTickets,
        resolvedTickets,
        openTickets: totalTickets - resolvedTickets
      };
    } else if (role === 'agent') {
      // Agent stats - show tickets assigned to them
      const totalTickets = await Ticket.countDocuments({ assignedAgent: userId });
      const newTickets = await Ticket.countDocuments({ assignedAgent: userId, status: 'New' });
      const assignedTickets = await Ticket.countDocuments({ assignedAgent: userId, status: 'Assigned' });
      const inProgressTickets = await Ticket.countDocuments({ assignedAgent: userId, status: 'In Progress' });
      const resolvedTickets = await Ticket.countDocuments({ assignedAgent: userId, status: 'Resolved' });
      const highPriorityTickets = await Ticket.countDocuments({ 
        assignedAgent: userId, 
        priority: 'High',
        status: { $ne: 'Resolved' }
      });

      stats = {
        totalTickets,
        newTickets,
        assignedTickets,
        inProgressTickets,
        resolvedTickets,
        highPriorityTickets
      };
    } else if (role === 'admin') {
      // Admin stats - all tickets
      const totalTickets = await Ticket.countDocuments();
      const newTickets = await Ticket.countDocuments({ status: 'New' });
      const assignedTickets = await Ticket.countDocuments({ status: 'Assigned' });
      const inProgressTickets = await Ticket.countDocuments({ status: 'In Progress' });
      const resolvedTickets = await Ticket.countDocuments({ status: 'Resolved' });
      const highPriorityTickets = await Ticket.countDocuments({ 
        priority: 'High',
        status: { $ne: 'Resolved' }
      });
      
      // Additional admin stats
      const totalCustomers = await User.countDocuments({ role: 'customer' });
      const totalAgents = await User.countDocuments({ role: 'agent' });
      
      // Tickets by category
      const ticketsByCategory = await Ticket.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]);

      // Tickets by priority
      const ticketsByPriority = await Ticket.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]);

      // Tickets by status
      const ticketsByStatus = await Ticket.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      // Agent workload — how many active (non-resolved, non-cancelled) tickets each agent holds
      const agentWorkload = await Ticket.aggregate([
        { $match: { assignedAgent: { $ne: null }, status: { $nin: ['Resolved', 'Cancelled'] } } },
        { $group: { _id: '$assignedAgent', activeTickets: { $sum: 1 } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'agent' } },
        { $unwind: '$agent' },
        { $project: { _id: 0, agentId: '$agent._id', name: '$agent.name', activeTickets: 1 } },
        { $sort: { activeTickets: -1 } }
      ]);

      stats = {
        totalTickets,
        newTickets,
        assignedTickets,
        inProgressTickets,
        resolvedTickets,
        highPriorityTickets,
        totalCustomers,
        totalAgents,
        ticketsByCategory,
        ticketsByPriority,
        ticketsByStatus,
        agentWorkload
      };
    }

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
};