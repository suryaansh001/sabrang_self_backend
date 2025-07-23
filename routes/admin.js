const express = require("express");
const { User, Event } = require("../models/models");
const router = express.Router();

router.get("/verify/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }


    const data = {
      _id: user._id,
      name: user.name,
      email: user.email,
      isvalidated: user.isvalidated,
    };

    res.json(data); 


  } catch (error) {
    console.error('Error verifying user:', error);

    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});


router.get("/events",async (req,res)=>{
  const event = await Event.find({});
  return res.json(event);
})

router.post("/update",async (req,res)=>{
  const event = await Event.findByIdAndUpdate(req.body._id,{
    name:req.body.name,
    coordinator:req.body.coordinator,
    mobile:req.body.mobile,
    date:req.body.date,
    whatsappLink:req.body.whatsappLink,
  })
  if (req.body && event){
    res.status(200).json({
      success: true,
      message: 'Event updated successfully'
    });
  }
})

module.exports = router;