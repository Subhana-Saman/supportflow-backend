import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Ticket from '../models/Ticket.js';
import Message from '../models/Message.js';
import { generateTicketNumber } from '../utils/generateTicketNumber.js';

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('📦 Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Ticket.deleteMany({});
    await Message.deleteMany({});
    console.log('🧹 Cleared existing data');

    // Create users - using create() with proper data
    const agent = await User.create({
      name: 'Support Agent',
      email: 'agent@supportflow.com',
      password: 'password123',
      role: 'agent'
    });
    console.log('✅ Agent created');

    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@supportflow.com',
      password: 'password123',
      role: 'admin'
    });
    console.log('✅ Admin created');

    const customer1 = await User.create({
      name: 'John Doe',
      email: 'customer1@supportflow.com',
      password: 'password123',
      role: 'customer'
    });
    console.log('✅ Customer 1 created');

    const customer2 = await User.create({
      name: 'Jane Smith',
      email: 'customer2@supportflow.com',
      password: 'password123',
      role: 'customer'
    });
    console.log('✅ Customer 2 created');

    console.log('👤 Created all users');

    // Create tickets
    const ticket1 = await Ticket.create({
      ticketNumber: await generateTicketNumber(),
      customer: customer1._id,
      assignedAgent: agent._id,
      subject: 'Unable to login to account',
      description: 'I keep getting an error when trying to login. It says "Invalid credentials" even though I\'m using the correct password.',
      category: 'Account',
      priority: 'High',
      status: 'In Progress'
    });

    const ticket2 = await Ticket.create({
      ticketNumber: await generateTicketNumber(),
      customer: customer2._id,
      assignedAgent: agent._id,
      subject: 'Payment not processed',
      description: 'I made a payment but it\'s not showing up in my account. Transaction ID: TX-12345',
      category: 'Billing',
      priority: 'High',
      status: 'Assigned'
    });

    const ticket3 = await Ticket.create({
      ticketNumber: await generateTicketNumber(),
      customer: customer1._id,
      subject: 'Feature request: Dark mode',
      description: 'It would be great to have a dark mode option for the dashboard.',
      category: 'Other',
      priority: 'Low',
      status: 'New'
    });

    const ticket4 = await Ticket.create({
      ticketNumber: await generateTicketNumber(),
      customer: customer2._id,
      assignedAgent: agent._id,
      subject: 'Order not delivered',
      description: 'I ordered a product 5 days ago but it hasn\'t been delivered yet. Order #ORD-67890',
      category: 'Order',
      priority: 'Medium',
      status: 'Resolved',
      resolutionNote: 'Order was delayed due to shipping issues. It has been dispatched and will arrive tomorrow.',
      resolvedAt: new Date()
    });

    console.log('🎫 Created tickets');

    // Create messages
    await Message.create([
      {
        ticket: ticket1._id,
        sender: customer1._id,
        message: 'I need help with my account. I can\'t login.'
      },
      {
        ticket: ticket1._id,
        sender: agent._id,
        message: 'I\'ll help you with that. Can you please tell me what error message you\'re seeing?'
      },
      {
        ticket: ticket1._id,
        sender: customer1._id,
        message: 'It says "Invalid credentials" even though I\'m using the correct password.'
      }
    ]);

    await Message.create([
      {
        ticket: ticket2._id,
        sender: customer2._id,
        message: 'My payment is not showing up in my account.'
      },
      {
        ticket: ticket2._id,
        sender: agent._id,
        message: 'I\'ll check this for you. Can you provide the transaction ID?'
      }
    ]);

    console.log('💬 Created messages');

    console.log('\n✅ SEED DATA COMPLETE');
    console.log('\n📋 Demo Credentials:');
    console.log('─────────────────────────────');
    console.log('Agent:    agent@supportflow.com  /  password123');
    console.log('Admin:    admin@supportflow.com  /  password123');
    console.log('Customer: customer1@supportflow.com  /  password123');
    console.log('Customer: customer2@supportflow.com  /  password123');
    console.log('─────────────────────────────');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seedData();