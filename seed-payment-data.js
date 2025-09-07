require("dotenv").config();
const mongoose = require("mongoose");
const { Event, CheckoutOffer, PromoCode } = require("./models/models");

// Connect to MongoDB
mongoose.connect(process.env.mongodb, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});

const seedData = async () => {
  try {
    console.log("🌱 Seeding payment-related data...");

    // Clear existing data
    await Event.deleteMany({});
    await CheckoutOffer.deleteMany({});
    await PromoCode.deleteMany({});

    // Create Events with prices
    const events = [
      {
        name: "RAMPWALK - PANACHE - THEME BASED",
        mobile: "9876543210",
        link: "https://forms.google.com/panache",
        coordinator: "Fashion Team",
        timings: "19:00 - 22:00",
        date: "25.12.2024",
        whatsappLink: "https://chat.whatsapp.com/panache",
        rules: "Theme-based rampwalk competition with original designs",
        image: "/images/about-section/Panache.png",
        description: "Sabrang's grandest fashion extravaganza. This year's theme-based rampwalk challenges participants to blend narrative with high fashion.",
        prize: "₹10,000",
        category: "Cultural",
        price: 120
      },
      {
        name: "BANDJAM",
        mobile: "9876543211",
        link: "https://forms.google.com/bandjam",
        coordinator: "Music Team",
        timings: "19:30 - 23:00",
        date: "27.12.2024",
        whatsappLink: "https://chat.whatsapp.com/bandjam",
        rules: "Original compositions and covers by student bands",
        image: "/images/about-section/Bandjam.png",
        description: "A showdown of student bands performing original compositions and covers. From rock and indie to classical fusion.",
        prize: "₹15,000",
        category: "Cultural",
        price: 60
      },
      {
        name: "DANCE BATTLE",
        mobile: "9876543212",
        link: "https://forms.google.com/dance",
        coordinator: "Dance Team",
        timings: "18:00 - 21:00",
        date: "28.12.2024",
        whatsappLink: "https://chat.whatsapp.com/dance",
        rules: "One-on-one and crew vs crew dance battles",
        image: "/images/about-section/Dance.png",
        description: "A one-on-one and crew vs. crew elimination dance face-off featuring hip-hop, freestyle, krumping, and fusion styles.",
        prize: "₹8,000",
        category: "Cultural",
        price: 45
      },
      {
        name: "STEP UP",
        mobile: "9876543213",
        link: "https://forms.google.com/stepup",
        coordinator: "Dance Team",
        timings: "18:00 - 21:30",
        date: "01.01.2025",
        whatsappLink: "https://chat.whatsapp.com/stepup",
        rules: "Group dance event focusing on choreography and synchronization",
        image: "/images/home2.png",
        description: "A high-energy group dance event where choreography, synchronization, stage usage, and innovation are key.",
        prize: "₹7,000",
        category: "Cultural",
        price: 40
      },
      {
        name: "ECHOES OF NOOR",
        mobile: "9876543214",
        link: "https://forms.google.com/echoes",
        coordinator: "Literature Team",
        timings: "16:00 - 18:00",
        date: "02.01.2025",
        whatsappLink: "https://chat.whatsapp.com/echoes",
        rules: "Original poetry and spoken word performances",
        image: "/images/Logo@2x.png",
        description: "A spoken word and poetry event celebrating the festival's theme, 'Noorwana'. Artists perform original pieces reflecting on light, cosmos, and inner luminescence.",
        prize: "₹3,000",
        category: "Cultural",
        price: 0 // Free event
      },
      {
        name: "TECH TALK - AI WORKSHOP",
        mobile: "9876543215",
        link: "https://forms.google.com/aiworkshop",
        coordinator: "Tech Team",
        timings: "18:00 - 20:00",
        date: "28.12.2024",
        whatsappLink: "https://chat.whatsapp.com/ai",
        rules: "Interactive AI/ML workshop for beginners",
        image: "/images/Logo@2x.png",
        description: "An interactive workshop on Artificial Intelligence and Machine Learning for beginners.",
        prize: "Certificate",
        category: "Technical",
        price: 30
      },
      {
        name: "PHOTOGRAPHY CONTEST",
        mobile: "9876543216",
        link: "https://forms.google.com/photo",
        coordinator: "Media Team",
        timings: "19:00 - 21:00",
        date: "25.12.2024",
        whatsappLink: "https://chat.whatsapp.com/photo",
        rules: "Capture the essence of Sabrang through photography",
        image: "/images/Logo@2x.png",
        description: "Capture the essence of Sabrang through your lens. Submit your best shots for a chance to win exciting prizes.",
        prize: "₹5,000",
        category: "Cultural",
        price: 20
      }
    ];

    const createdEvents = await Event.insertMany(events);
    console.log(`✅ Created ${createdEvents.length} events`);

    // Create a dummy user ID for offers (in real scenario, this would be an admin user)
    const dummyUserId = new mongoose.Types.ObjectId();

    // Create Checkout Offers
    const offers = [
      {
        offerName: "Flagship Combo",
        description: "All flagship events at an unbeatable price",
        events: [
          { eventId: createdEvents[0]._id, customPrice: null }, // PANACHE
          { eventId: createdEvents[1]._id, customPrice: null }, // BANDJAM
          { eventId: createdEvents[2]._id, customPrice: null }, // DANCE BATTLE
          { eventId: createdEvents[3]._id, customPrice: null }  // STEP UP
        ],
        comboPrice: 180,
        originalTotalPrice: 265, // 120+60+45+40
        discountPercentage: 32,
        validFrom: new Date(),
        validUntil: new Date('2025-01-05'),
        maxPurchases: null,
        createdBy: dummyUserId
      },
      {
        offerName: "Complete Experience",
        description: "All events including creative arts and workshops",
        events: createdEvents.filter(e => e.price > 0).map(e => ({ eventId: e._id, customPrice: null })),
        comboPrice: 200,
        originalTotalPrice: 275, // Sum of all paid events
        discountPercentage: 27,
        validFrom: new Date(),
        validUntil: new Date('2025-01-05'),
        maxPurchases: null,
        createdBy: dummyUserId
      },
      {
        offerName: "Premium VIP",
        description: "Flagship events with VIP access and exclusive perks",
        events: [
          { eventId: createdEvents[0]._id, customPrice: 150 }, // PANACHE VIP
          { eventId: createdEvents[1]._id, customPrice: 80 },  // BANDJAM VIP
          { eventId: createdEvents[2]._id, customPrice: 60 },  // DANCE BATTLE VIP
          { eventId: createdEvents[3]._id, customPrice: 50 }   // STEP UP VIP
        ],
        comboPrice: 250,
        originalTotalPrice: 340,
        discountPercentage: 26,
        validFrom: new Date(),
        validUntil: new Date('2025-01-05'),
        maxPurchases: 50,
        createdBy: dummyUserId
      }
    ];

    const createdOffers = await CheckoutOffer.insertMany(offers);
    console.log(`✅ Created ${createdOffers.length} checkout offers`);

    // Create Promo Codes
    const promoCodes = [
      {
        code: "EARLYBIRD",
        discountType: "percentage",
        discountValue: 15,
        maxDiscountAmount: 50,
        minOrderAmount: 100,
        validFrom: new Date(),
        validUntil: new Date('2024-12-20'),
        usageLimit: 100,
        description: "Early bird discount for first 100 customers",
        createdBy: dummyUserId
      },
      {
        code: "STUDENT50",
        discountType: "fixed",
        discountValue: 50,
        minOrderAmount: 150,
        validFrom: new Date(),
        validUntil: new Date('2025-01-05'),
        usageLimit: 200,
        allowedEmailDomains: ["jklu.edu.in", "student.edu"],
        description: "₹50 off for students",
        createdBy: dummyUserId
      },
      {
        code: "WELCOME10",
        discountType: "percentage",
        discountValue: 10,
        maxDiscountAmount: 30,
        minOrderAmount: 50,
        validFrom: new Date(),
        validUntil: new Date('2025-01-10'),
        usageLimit: 500,
        description: "Welcome discount for new users",
        createdBy: dummyUserId
      },
      {
        code: "FESTIVAL25",
        discountType: "percentage",
        discountValue: 25,
        maxDiscountAmount: 100,
        minOrderAmount: 200,
        validFrom: new Date(),
        validUntil: new Date('2025-01-02'),
        usageLimit: 50,
        description: "Special festival discount",
        createdBy: dummyUserId
      },
      {
        code: "COMBO20",
        discountType: "fixed",
        discountValue: 20,
        minOrderAmount: 100,
        validFrom: new Date(),
        validUntil: new Date('2025-01-05'),
        usageLimit: 300,
        applicableOffers: [createdOffers[0]._id, createdOffers[1]._id], // Only for specific offers
        description: "₹20 off on combo packages",
        createdBy: dummyUserId
      }
    ];

    const createdPromoCodes = await PromoCode.insertMany(promoCodes);
    console.log(`✅ Created ${createdPromoCodes.length} promo codes`);

    console.log("\n🎉 Seeding completed successfully!");
    console.log("\n📋 Available Promo Codes:");
    createdPromoCodes.forEach(code => {
      console.log(`   ${code.code}: ${code.description}`);
    });

    console.log("\n🎪 Available Events:");
    createdEvents.forEach(event => {
      console.log(`   ${event.name}: ₹${event.price}`);
    });

    console.log("\n🎁 Available Offers:");
    createdOffers.forEach(offer => {
      console.log(`   ${offer.offerName}: ₹${offer.comboPrice} (${offer.discountPercentage}% off)`);
    });

  } catch (error) {
    console.error("❌ Error seeding data:", error);
  } finally {
    mongoose.connection.close();
  }
};

seedData();
