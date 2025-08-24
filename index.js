require('dotenv').config();
const { Telegraf, Markup, Scenes, session } = require('telegraf');
const { MongoClient } = require('mongodb');
const express = require('express');
const app = express();


// Load environment variables
const token = process.env.BOT_TOKEN;
const mongoUri = process.env.MONGO_URI;
const adminUserId = process.env.ADMIN_USER_ID;

if (!token || !mongoUri || !adminUserId) {
  console.error('Error: BOT_TOKEN, MONGO_URI, and ADMIN_USER_ID must be set in .env file');
  process.exit(1);
}

const mongoClient = new MongoClient(mongoUri, { useUnifiedTopology: true });
app.get('/ping', (req, res) => {
  res.status(200).send('OK');
});

// Start HTTP server on port 3000 or your desired port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`HTTP server is running on port ${PORT}`);
});

// Services data
const services = {
  'AI Automation': {
    description: 'AI Automation Solutions: Building intelligent systems to automate tasks using ML and AI technologies.',
    relatedProjects: ['Smart Outfit Recommendation System (ML-based)'],
  },
  'Chatbot Development': {
    description: 'Chatbot & Bot Development: Custom bots for Telegram, web, and more, like this one!',
    relatedProjects: ['ChitChat (Real-time Chat App)'],
  },
  'Web Development': {
    description: 'Web Development (Frontend & Full-stack): Creating responsive websites with React.js, Node.js, and more.',
    relatedProjects: ['Pop Crat (Fashion E-commerce Platform)', 'Portfolio Website'],
  },
  'UI/UX Design': {
    description: 'UI/UX Design Services: Designing intuitive interfaces for apps and websites.',
    relatedProjects: ['Perpetual (Trading Platform UI/UX)', 'Food Delivery App UI/UX'],
  },
  'Workflow Automation': {
    description: 'Workflow Automation & Integration: Streamlining processes with tools like MongoDB, AWS, and GitHub Actions.',
    relatedProjects: ['Vajra (Medical Emergency Platform)'],
  },
};


// Achievements data
const achievements = [
  'Winner – First place in Smart India Hackathon (SIH) internal college round (out of 124 teams)',
  '8th Place – Inter-college hackathon at Bennett University (out of 140 teams)',
  'Top 10 Contributor – Script Winter of Code (SWoC)',
  '2nd Position – Tech Pravaah\'22 (ABES Engineering College)',
  'Certifications: AWS Academy Cloud Foundations, Postman API Fundamentals, HackerRank Problem Solving, Coursera UX Design, Webflow No-code Website.',
];

// Create the bot
const bot = new Telegraf(token);

// Inquiry Wizard Scene
const inquiryWizard = new Scenes.WizardScene(
  'inquiry',
  async (ctx) => {
    ctx.session.inquiryData = { service: ctx.session.service || 'Unknown' };
    console.log('Step 1: Initialized inquiryData:', ctx.session.inquiryData);
    await ctx.reply('Please enter your email address:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      await ctx.reply('Please provide a valid email address.');
      return;
    }
    ctx.session.inquiryData.email = ctx.message.text;
    console.log('Step 2: Updated inquiryData:', ctx.session.inquiryData);
    await ctx.reply('Please describe your project or requirements:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      await ctx.reply('Please provide a valid project description.');
      return;
    }
    ctx.session.inquiryData.description = ctx.message.text;
    console.log('Step 3: Final inquiryData:', ctx.session.inquiryData);
    const { service, email, description } = ctx.session.inquiryData;
    await ctx.reply(
      `Confirm your inquiry:\nService: ${service}\nEmail: ${email}\nDescription: ${description}`,
      Markup.inlineKeyboard([
        Markup.button.callback('Confirm', 'confirm'),
        Markup.button.callback('Cancel', 'cancel'),
      ])
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    return ctx.scene.leave();
  }
);

// Stage to manage scenes
const stage = new Scenes.Stage([inquiryWizard], { ttl: 600 });

// Use session and stage middleware
bot.use(session({ defaultSession: () => ({ inquiryData: {}, service: null }) }));
bot.use(stage.middleware());

// Connect to MongoDB and verify database/collection
async function connectMongo() {
  try {
    await mongoClient.connect();
    console.log('Connected to MongoDB');
    const db = mongoClient.db('freelance_bot');
    await db.command({ ping: 1 });
    console.log('MongoDB ping successful');
    // Check if inquiries collection exists, create if not
    const collections = await db.listCollections().toArray();
    const collectionExists = collections.some(col => col.name === 'inquiries');
    if (!collectionExists) {
      await db.createCollection('inquiries');
      console.log('Created inquiries collection');
    } else {
      console.log('Inquiries collection already exists');
    }
  } catch (err) {
    console.error('MongoDB connection error:', err.message, err.stack);
    process.exit(1);
  }
}
connectMongo();

// Start command with main menu
bot.start((ctx) => {
  ctx.reply(
    'Hi! I’m Ashad Muneer’s freelancing bot. I help businesses grow with AI automation, chatbots, and smart workflows. Need a stunning website? I create fast, responsive sites that engage users. Looking for better user experience? My UI/UX designs simplify interactions. From automating tasks to building custom solutions, I make your work easier. Let’s create something impactful together!\n\nSelect an option:',
    Markup.inlineKeyboard([
      [Markup.button.callback('AI Automation', 'service_AI Automation')],
      [Markup.button.callback('Chatbot Development', 'service_Chatbot Development')],
      [Markup.button.callback('Web Development', 'service_Web Development')],
      [Markup.button.callback('UI/UX Design', 'service_UI/UX Design')],
      [Markup.button.callback('Workflow Automation', 'service_Workflow Automation')],
      [Markup.button.callback('View Portfolio', 'portfolio')],
      [Markup.button.callback('Achievements & Certs', 'achievements')],
      [Markup.button.callback('Contact Me', 'contact')],
    ])
  );
});

// Handle service selections
bot.action(/service_(.+)/, (ctx) => {
  const serviceKey = ctx.match[1];
  const service = services[serviceKey];
  let reply = `${serviceKey}: ${service.description}\n\nRelated Projects:\n- ${service.relatedProjects.join('\n- ')}`;
  ctx.reply(
    reply,
    Markup.inlineKeyboard([
      Markup.button.callback('Inquire about this', `inquire_${serviceKey}`),
      Markup.button.callback('Back to Menu', 'back'),
    ])
  );
  ctx.answerCbQuery();
});

// Start inquiry
bot.action(/inquire_(.+)/, (ctx) => {
  const service = ctx.match[1];
  ctx.session.service = service;
  console.log('Inquiry started for service:', service);
  ctx.scene.enter('inquiry');
  ctx.answerCbQuery('Starting inquiry...');
});

// Handle wizard confirmation/cancel
bot.action('confirm', async (ctx) => {
  if (!ctx.session.inquiryData || !ctx.session.inquiryData.service) {
    console.error('Error: Inquiry data missing', ctx.session);
    await ctx.reply('Error: Inquiry data missing. Please start over with /start.');
    ctx.answerCbQuery();
    return ctx.scene.leave();
  }
  const { service, email, description } = ctx.session.inquiryData;
  try {
    const db = mongoClient.db('freelance_bot');
    const result = await db.collection('inquiries').insertOne({
      service,
      email,
      description,
      userId: ctx.from.id,
      username: ctx.from.username || 'unknown',
      timestamp: new Date(),
    });
    console.log('MongoDB insert successful:', result.insertedId);
    await ctx.reply('Inquiry submitted! Ashad will contact you soon.');
    ctx.session.inquiryData = {}; // Clear inquiry data
  } catch (err) {
    console.error('MongoDB insert error:', err.message, err.stack);
    await ctx.reply('Error saving inquiry. Please try again later.');
  }
  ctx.answerCbQuery();
  ctx.scene.leave();
});

bot.action('cancel', (ctx) => {
  console.log('Inquiry canceled, clearing session data');
  ctx.session.inquiryData = {};
  ctx.reply('Inquiry canceled.');
  ctx.answerCbQuery();
  ctx.scene.leave();
});

// Admin send message to specific user
bot.command('sendmsg', async (ctx) => {
  // Check if the user is the admin
  if (ctx.from.id.toString() !== adminUserId) {
    await ctx.reply('Error: Only the admin can use this command.');
    return;
  }

  // Parse command: /sendmsg <userId> <message>
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) {
    await ctx.reply('Usage: /sendmsg <userId> <message>');
    return;
  }

  const userId = args[0];
  const message = args.slice(1).join(' ');

  try {
    const db = mongoClient.db('freelance_bot');
    // Verify user exists in inquiries collection
    const user = await db.collection('inquiries').findOne({ userId: parseInt(userId) });
    if (!user) {
      await ctx.reply(`Error: No user found with ID ${userId}.`);
      return;
    }

    // Send message to user
    await bot.telegram.sendMessage(userId, message);
    await ctx.reply(`Message sent to user ${userId}: ${message}`);
  } catch (err) {
    console.error('Error sending message:', err.message, err.stack);
    await ctx.reply(`Error sending message to user ${userId}: ${err.message}`);
  }
});

// Admin broadcast message to all users
bot.command('sendall', async (ctx) => {
  // Check if the user is the admin
  if (ctx.from.id.toString() !== adminUserId) {
    await ctx.reply('Error: Only the admin can use this command.');
    return;
  }

  // Parse command: /sendall <message>
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 1) {
    await ctx.reply('Usage: /sendall <message>');
    return;
  }

  const message = args.join(' ');

  try {
    const db = mongoClient.db('freelance_bot');
    // Get all unique user IDs from inquiries collection
    const users = await db.collection('inquiries').distinct('userId');
    if (users.length === 0) {
      await ctx.reply('No users found in the inquiries collection.');
      return;
    }

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    // Send message to each user
    for (const userId of users) {
      try {
        await bot.telegram.sendMessage(userId, message);
        successCount++;
      } catch (err) {
        failCount++;
        errors.push(`Failed to send to ${userId}: ${err.message}`);
      }
    }

    // Report results
    await ctx.reply(
      `Broadcast completed: ${successCount} messages sent successfully, ${failCount} failed.\n` +
      (failCount > 0 ? `Errors:\n${errors.join('\n')}` : '')
    );
  } catch (err) {
    console.error('Error broadcasting message:', err.message, err.stack);
    await ctx.reply('Error broadcasting message. Please try again later.');
  }
});

// Portfolio command
bot.command('portfolio', (ctx) => {
  ctx.reply(`To see my projects and more details about me, visit my portfolio website: https://ashad.info`);
});

// Achievements command
bot.command('achievements', (ctx) => {
  ctx.reply(`My Achievements & Certifications:\n\n${achievements.join('\n\n')}`);
});

// Contact action
bot.action('contact', (ctx) => {
ctx.reply(
  'Contact Ashad via email: ashadmuneerofficial@gmail.com, LinkedIn (linkedin.com/in/ashadmuneer), or visit my portfolio: https://ashad.info'
);
  ctx.answerCbQuery();
});

// Back to menu
bot.action('back', (ctx) => {
  ctx.reply('Back to main menu:', Markup.inlineKeyboard([
    [Markup.button.callback('AI Automation', 'service_AI Automation')],
    [Markup.button.callback('Chatbot Development', 'service_Chatbot Development')],
    [Markup.button.callback('Web Development', 'service_Web Development')],
    [Markup.button.callback('UI/UX Design', 'service_UI/UX Design')],
    [Markup.button.callback('Workflow Automation', 'service_Workflow Automation')],
    [Markup.button.callback('View Portfolio', 'portfolio')],
    [Markup.button.callback('Achievements & Certs', 'achievements')],
    [Markup.button.callback('Contact Me', 'contact')],
  ]));
  ctx.answerCbQuery();
});

// Portfolio button
bot.action('portfolio', (ctx) => {
  ctx.reply(`To see my projects and more details about me, visit my portfolio website: https://ashad.info`);
  ctx.answerCbQuery();
});

// Achievements button
bot.action('achievements', (ctx) => {
  ctx.reply(`My Achievements & Certifications:\n\n${achievements.join('\n\n')}`);
  ctx.answerCbQuery();
});

// Error handling
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err.message, err.stack);
  ctx.reply('Sorry, an error occurred. Try again or contact support.');
});

// Launch the bot
bot.launch();
console.log('Bot is running...');

// Graceful stop
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  mongoClient.close();
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  mongoClient.close();
});