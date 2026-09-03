import mongoose from 'mongoose';

const ticketActivitySchema = new mongoose.Schema({
  ticket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true
  },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: [
      'created',
      'assigned',
      'category_changed',
      'priority_changed',
      'status_changed',
      'resolved',
      'cancelled',
      'reopened'
    ],
    required: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
ticketActivitySchema.index({ ticket: 1, createdAt: 1 });

const TicketActivity = mongoose.model('TicketActivity', ticketActivitySchema);
export default TicketActivity;