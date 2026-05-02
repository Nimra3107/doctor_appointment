import mongoose, { connect } from "mongoose";

const connectDB = async()=>{
    try {
        mongoose.connection.on('connected',()=> console.log("Database Connected"));
        await mongoose.connect(`${process.env.MONGODB_URI}/prescripto`)  //to connect with mongodb
    } catch (error) {
        console.error(error.message);
    }
}

export default connectDB;