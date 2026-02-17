const mongoose=require("mongoose");

// ---------- COMMON SUB SCHEMAS ----------
const feeHeadSchema=new mongoose.Schema({
  name:{type:String,required:true,trim:true},
  amount:{type:Number,required:true,min:0}
},{_id:false});

const tuitionSchema=new mongoose.Schema({
  quota:{
    type:String,
    enum:["Counselling","Management"],
    required:true
  },
  department:{type:String,required:true,trim:true},
  semester:{type:Number,required:true},

  feeHeads:[feeHeadSchema],
  totalAmount:{type:Number,required:true,min:0},

  isActive:{type:Boolean,default:true}
},{_id:false});

const transportSchema=new mongoose.Schema({
  routeName:{type:String,trim:true},
  location:{type:String,required:true,trim:true},
  distanceKM:{type:Number,required:true,min:0},
  fee:{type:Number,required:true,min:0},

  isActive:{type:Boolean,default:true}
},{_id:false});

const hostelSchema=new mongoose.Schema({
  block:{type:String,required:true,trim:true},
  sharingType:{
    type:String,
    enum:["Single","Double","Triple","Dormitory"],
    required:true
  },

  roomFee:{type:Number,default:0,min:0},
  messFee:{type:Number,default:0,min:0},
  maintenanceFee:{type:Number,default:0,min:0},

  totalFee:{type:Number,required:true,min:0},

  isActive:{type:Boolean,default:true}
},{_id:false});


// ---------- MASTER FEE STRUCTURE ----------
const feeStructureMasterSchema=new mongoose.Schema({

  academicYear:{
    type:String,
    required:true,
    unique:true,   // PK
    trim:true
  },

  tuitionStructures:[tuitionSchema],
  transportStructures:[transportSchema],
  hostelStructures:[hostelSchema],

  createdBy:{type:mongoose.Schema.Types.ObjectId},
  updatedBy:{type:mongoose.Schema.Types.ObjectId},

  notes:{type:String,trim:true,maxlength:300}

},{timestamps:true});

module.exports=mongoose.model("FeeStructureMaster",feeStructureMasterSchema);



// {
//   "academicYear": "2025-2026",

//   "tuitionStructures": [
//     {
//       "quota": "Counselling",
//       "department": "CSE",
//       "semester": 3,
//       "feeHeads": [
//         { "name": "Tuition Fee", "amount": 25000 },
//         { "name": "Lab Fee", "amount": 5000 },
//         { "name": "Exam Fee", "amount": 3000 },
//         { "name": "Library Fee", "amount": 2000 }
//       ],
//       "totalAmount": 35000,
//       "isActive": true
//     },
//     {
//       "quota": "Management",
//       "department": "CSE",
//       "semester": 3,
//       "feeHeads": [
//         { "name": "Tuition Fee", "amount": 45000 },
//         { "name": "Lab Fee", "amount": 5000 },
//         { "name": "Exam Fee", "amount": 3000 },
//         { "name": "Library Fee", "amount": 2000 }
//       ],
//       "totalAmount": 55000,
//       "isActive": true
//     }
//   ],

//   "transportStructures": [
//     {
//       "routeName": "Pollachi Route",
//       "location": "Pollachi Bus Stand",
//       "distanceKM": 35,
//       "fee": 18000,
//       "isActive": true
//     },
//     {
//       "routeName": "Kinathukadavu Route",
//       "location": "Kinathukadavu",
//       "distanceKM": 20,
//       "fee": 12000,
//       "isActive": true
//     }
//   ],

//   "hostelStructures": [
//     {
//       "block": "A Block",
//       "sharingType": "Single",
//       "roomFee": 60000,
//       "messFee": 20000,
//       "maintenanceFee": 5000,
//       "totalFee": 85000,
//       "isActive": true
//     },
//     {
//       "block": "A Block",
//       "sharingType": "Double",
//       "roomFee": 45000,
//       "messFee": 20000,
//       "maintenanceFee": 5000,
//       "totalFee": 70000,
//       "isActive": true
//     },
//     {
//       "block": "B Block",
//       "sharingType": "Triple",
//       "roomFee": 30000,
//       "messFee": 18000,
//       "maintenanceFee": 4000,
//       "totalFee": 52000,
//       "isActive": true
//     }
//   ],

//   "notes": "Approved fee structure for academic year 2025-2026"
// }
