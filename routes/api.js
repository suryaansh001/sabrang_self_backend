require("dotenv").config();
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { User, Event } = require("../models/models");
const path = require('path');
const fs = require('fs');
const qr = require('qr-image');


router.get('/qrcode/:id', (req, res) => {
  const id = req.params.id;
  const filename = `${id}.png`;
  const filePath = path.join(__dirname, '../public/qrcodes', filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('QR code not found'); 
    }

  res.type('png');
  fs.createReadStream(filePath).pipe(res);
});





router.get("/user",async (req,res)=>{
    try{
    
    const token = req.cookies.jwt;
    const claims = jwt.verify(token,process.env.jwtkey);

    if(!claims){
        return res.status(401).send({
            "message":"unauthenticated"
        })
    }
    
    const user = await User.findOne({_id:claims._id});
    const events = user.events;
    const eventData = [];
    for (i=0;i<events.length;i++){
    const info = await Event.findOne({name:events[i]});
    if (info) {
      eventData.push(info);
    }
    } 

    console.log(eventData)

    const data = {
    _id:user._id,
    name: user.name,
    email: user.email,
    profileImage: "/images/default-avatar.jpg",
    qrPath:user.qrPath,
    registeredEvents: eventData,
    }

    return res.send(data)
    }catch (e){
        return res.status(401).send({
            message:"unauthenticated"
        })
    }   
}
);



module.exports = router;