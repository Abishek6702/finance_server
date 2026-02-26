const mongoose=require("mongoose");

const transportSchema=new mongoose.Schema({
  route:{type:String,trim:true,required:true},
  busNo:{type:String,trim:true,required:true},
  stop:{type:String,trim:true,required:true}
});

transportSchema.index({route:1,busNo:1,stop:1},{unique:true});

const Transport=mongoose.model("Transport",transportSchema);

/*******************************************************/

const data = [
  {
    "route": "Bharathiyar University",
    "busNo": "1",
    "stops": [
      "Bharathiyar University",
      "Vadavalli",
      "Milk company",
      "Gandhipark",
      "Ukkadam",
      "Sundarapuram",
      "Premier mills",
      "Kinathukadavu"
    ]
  },
  {
    "route": "Kottampatti - Pollachi",
    "busNo": "2",
    "stops": [
      "Kottampatti",
      "Pollachi",
      "Vadakipalayam privu",
      "Kovilpalayam",
      "Thamaraikulam",
      "Kinathukadavu"
    ]
  },
  {
    "route": "Saravanampatti (Via Ramanathapuram & Chettipalayam)",
    "busNo": "3",
    "stops": [
      "Saravanampatti",
      "Gandhipuram – Thiruvallur bus stand",
      "Women’s polytechnic",
      "Lakshmi mills",
      "Ramanathapuram",
      "Nanjundapuram GD tank",
      "Chettipalayam",
      "Panapatti pirivu",
      "Vadasithur"
    ]
  },
  {
    "route": "Kovai pudur (Via Madukari Market)",
    "busNo": "4",
    "stops": [
      "Kovaipudur",
      "Sundakamuthur",
      "Perur",
      "Selvapuram",
      "Puttuviki",
      "Kuniamuthur High School",
      "Madukkarai Quary Office",
      "Madukkarai market",
      "Malumichampatti",
      "Kinathukadavu"
    ]
  },
  {
    "route": "Vadakkipalayam pirivu - Chenniyur (Via sulakkal)",
    "busNo": "5",
    "stops": [
      "Vadakipalayam Pirivu",
      "Ponnapuram pirivu",
      "Vadakipalayam",
      "Sulakkal",
      "Chennaiyur",
      "Sulakkal – Roots Company road",
      "Thamaraikulam",
      "Kinathukadavu"
    ]
  },
  {
    "route": "Sulur (Via Ramanathapuram)",
    "busNo": "6",
    "stops": [
      "Sulur",
      "Ondipudur",
      "Siganallur",
      "Sowripalayam",
      "Puliyakulam",
      "Ramanathapuram",
      "Najundapuram",
      "Chettipalayam – Vadasithur"
    ]
  },
  {
    "route": "Tirupur - GH (Via Old Bus stand,Mangalam)",
    "busNo": "9",
    "stops": [
      "Kovil vazhi Bus stand",
      "Old bus Stand",
      "mangalam",
      "63-Velampalayam",
      "Palladam GH",
      "Karaidivavi",
      "Sellakarachal",
      "Lakshiminaiyakanpalayam",
      "Panapatti",
      "Panapatti pirivu",
      "Vadasithur"
    ]
  },
  {
    "route": "Dhali (Via Negamam)",
    "busNo": "11",
    "stops": [
      "Kurichikottai",
      "Dhali",
      "Erichanampaatti",
      "Kondigiyam",
      "Udukkampalayam",
      "Lakshmapuram",
      "Kedimedu",
      "Singuvadai",
      "Poosaripatti",
      "Negamam",
      "Cheetipudur",
      "Vadasithur"
    ]
  },
  {
    "route": "Pollachi (Via Negemam)",
    "busNo": "12",
    "stops": [
      "Pollachi Their Nilayam",
      "Puliyampatti",
      "Negamam",
      "Vadasithur"
    ]
  }
]


const seedTransport=async()=>{
  const docs=[];

  data.forEach(r=>{
    r.stops.forEach(stop=>{
      docs.push({
        route:r.route,
        busNo:r.busNo,
        stop
      });
    });
  });

  await Transport.deleteMany({});

  await Transport.insertMany(docs,{
    ordered:false    
  });
 
};

module.exports={Transport,seedTransport};