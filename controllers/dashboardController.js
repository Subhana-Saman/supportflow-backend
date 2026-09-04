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

      // SLA: this agent's own average response time (minutes)
      const agentAvgResponseAgg = await Ticket.aggregate([
        { $match: { assignedAgent: userId, firstResponseAt: { $ne: null } } },
        {
          $project: {
            responseMinutes: {
              $divide: [{ $subtract: ['$firstResponseAt', '$createdAt'] }, 60000]
            }
          }
        },
        { $group: { _id: null, avgMinutes: { $avg: '$responseMinutes' } } }
      ]);
      const avgResponseTimeMinutes = agentAvgResponseAgg[0]
        ? Math.round(agentAvgResponseAgg[0].avgMinutes)
        : null;

      stats = {
        totalTickets,
        newTickets,
        assignedTickets,
        inProgressTickets,
        resolvedTickets,
        highPriorityTickets,
        avgResponseTimeMinutes
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

      // SLA: average time (in minutes) from ticket creation to first agent response
      const avgResponseAgg = await Ticket.aggregate([
        { $match: { firstResponseAt: { $ne: null } } },
        {
          $project: {
            responseMinutes: {
              $divide: [{ $subtract: ['$firstResponseAt', '$createdAt'] }, 60000]
            }
          }
        },
        { $group: { _id: null, avgMinutes: { $avg: '$responseMinutes' } } }
      ]);
      const avgResponseTimeMinutes = avgResponseAgg[0]
        ? Math.round(avgResponseAgg[0].avgMinutes)
        : null;

      // SLA: average time (in minutes) from ticket creation to resolution
      const avgResolutionAgg = await Ticket.aggregate([
        { $match: { resolvedAt: { $ne: null } } },
        {
          $project: {
            resolutionMinutes: {
              $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 60000]
            }
          }
        },
        { $group: { _id: null, avgMinutes: { $avg: '$resolutionMinutes' } } }
      ]);
      const avgResolutionTimeMinutes = avgResolutionAgg[0]
        ? Math.round(avgResolutionAgg[0].avgMinutes)
        : null;

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
        agentWorkload,
        avgResponseTimeMinutes,
        avgResolutionTimeMinutes
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