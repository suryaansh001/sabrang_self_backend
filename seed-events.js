const mongoose = require("mongoose");
const { Event } = require("./models/models");

// Sample events data
const sampleEvents = [
  {
    name: "Panache",
    coordinator: "John Doe",
    mobile: "+91 9876543210",
    date: "March 15, 2025",
    whatsappLink: "https://chat.whatsapp.com/sample1",
    timings: "10:00 AM - 4:00 PM",
    link: "",
    rules: `• Team size: 4-6 members
• Theme-based fashion showcase
• Each team gets 8 minutes on stage
• Props and costumes allowed
• No offensive content
• Original music tracks preferred
• Registration fee: ₹500 per team`,
    image: "/images/building-6011756_1280.jpg",
    description: "A grand fashion show showcasing creativity and style.",
    prize: "₹50,000",
    category: "Cultural"
  },
  {
    name: "Band Jam",
    coordinator: "Jane Smith",
    mobile: "+91 9876543211",
    date: "March 16, 2025",
    whatsappLink: "https://chat.whatsapp.com/sample2",
    timings: "6:00 PM - 10:00 PM",
    link: "",
    rules: `• Team size: 4-8 members
• Original compositions encouraged
• 15 minutes performance time
• All genres welcome (rock, metal, fusion)
• Sound equipment provided
• No explicit lyrics
• Registration fee: ₹800 per team`,
    image: "/events/bandjam.jpg",
    description: "Battle of the bands - rock, metal, and fusion.",
    prize: "₹40,000",
    category: "Cultural"
  },
  {
    name: "Hackathon",
    coordinator: "Alex Johnson",
    mobile: "+91 9876543212",
    date: "March 15, 2025",
    whatsappLink: "https://chat.whatsapp.com/sample3",
    timings: "24 Hours",
    link: "https://devfolio.co/hackathon",
    rules: `• Team size: 2-4 members
• 24-hour coding competition
• Problem statements will be given on spot
• Any programming language allowed
• Internet access provided
• Mentorship available
• Registration fee: ₹400 per team`,
    image: "/events/hackathon.jpg",
    description: "24-hour coding competition to solve real-world problems.",
    prize: "₹1,00,000",
    category: "Technical"
  },
  {
    name: "Business Plan",
    coordinator: "Sarah Wilson",
    mobile: "+91 9876543213",
    date: "March 15, 2025",
    whatsappLink: "https://chat.whatsapp.com/sample4",
    timings: "9:00 AM - 5:00 PM",
    link: "",
    rules: `• Team size: 3-4 members
• 15-minute presentation + 5 minutes Q&A
• PowerPoint presentation mandatory
• Business model should be feasible
• Market research required
• Financial projections needed
• Registration fee: ₹300 per team`,
    image: "/events/businessplan.jpg",
    description: "Present your innovative business ideas to industry experts.",
    prize: "₹60,000",
    category: "Management"
  },
  {
    name: "Fashion Show",
    coordinator: "Emily Davis",
    mobile: "+91 9876543214",
    date: "March 17, 2025",
    whatsappLink: "https://chat.whatsapp.com/sample5",
    timings: "2:00 PM - 6:00 PM",
    link: "",
    rules: `• Team size: 3-5 members
• Sustainable fashion theme
• 6 minutes showcase time
• Eco-friendly materials preferred
• Creative choreography encouraged
• Professional music tracks only
• Registration fee: ₹450 per team`,
    image: "/events/fashionshow.jpg",
    description: "Showcase your unique style and creativity.",
    prize: "₹35,000",
    category: "Cultural"
  },
  {
    name: "Tech Quiz",
    coordinator: "Michael Brown",
    mobile: "+91 9876543215",
    date: "March 16, 2025",
    whatsappLink: "https://chat.whatsapp.com/sample6",
    timings: "11:00 AM - 1:00 PM",
    link: "",
    rules: `• Team size: 2 members
• Multiple rounds (prelims, semifinals, finals)
• Topics: CS, IT, General Tech, Current Affairs
• No electronic devices allowed
• Time limit for each question
• Negative marking in final round
• Registration fee: ₹200 per team`,
    image: "/events/techquiz.jpg",
    description: "Test your knowledge in technology and science.",
    prize: "₹50,000",
    category: "Technical"
  }
];

async function seedEvents() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.mongodb || "mongodb://localhost:27017/sabrang");
    console.log("Connected to MongoDB");

    // Clear existing events
    const deleteResult = await Event.deleteMany({});
    console.log(`Cleared ${deleteResult.deletedCount} existing events`);

    // Insert sample events
    const insertResult = await Event.insertMany(sampleEvents);
    console.log(`Sample events inserted successfully: ${insertResult.length} events`);

    // Verify insertion
    const count = await Event.countDocuments();
    console.log(`Total events in database: ${count}`);

    console.log("Seeding completed!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding events:", error);
    process.exit(1);
  }
}

seedEvents();
