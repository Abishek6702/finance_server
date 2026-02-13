const mongoose = require('mongoose');
const dontenv = require('dotenv');

dontenv.config();

const connectDB = async()=>{
    try{
        await mongoose.connect(process.env.MONGO_URI); 
        console.log('MongoDB Connected Sucessfully');
    } catch (error){
        console.error('MongoDb Connection Failed :', error.moessage || error);
        process.exit(1);
    }
};

module.exports = connectDB