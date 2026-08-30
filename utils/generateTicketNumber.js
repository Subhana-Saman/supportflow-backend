import Ticket from '../models/Ticket.js';

export const generateTicketNumber = async () => {
  try {
    const lastTicket = await Ticket.findOne().sort({ ticketNumber: -1 });
    
    let nextNumber = 10001;
    if (lastTicket && lastTicket.ticketNumber) {
      const match = lastTicket.ticketNumber.match(/SUP-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    
    return `SUP-${nextNumber}`;
  } catch (error) {
    console.error('Error generating ticket number:', error);
    return `SUP-${Date.now()}`;
  }
};