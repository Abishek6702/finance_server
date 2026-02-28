const mongoose = require("mongoose");

const transportSchema = new mongoose.Schema({
  route: { type: String, trim: true, required: true },
  busNo: { type: String, trim: true, required: true },
  stop: { type: String, trim: true, required: true },
  fee: { type: Number, required: true, min: 0 }
});

transportSchema.index({ route: 1, busNo: 1, stop: 1 }, { unique: true });

const Transport = mongoose.model("Transport", transportSchema);

/*******************************************************/

const data = [
  {
    "route": "Bharathiyar University",
    "busNo": "1",
    "stops": [
      { name: "Bharathiyar University", fee: 15000 },
      { name: "Vadavalli", fee: 14000 },
      { name: "Milk company", fee: 13000 },
      { name: "Gandhipark", fee: 12000 },
      { name: "Ukkadam", fee: 11000 },
      { name: "Sundarapuram", fee: 10000 },
      { name: "Premier mills", fee: 9000 },
      { name: "Kinathukadavu", fee: 8000 }
    ]
  },
  {
    "route": "Kottampatti - Pollachi",
    "busNo": "2",
    "stops": [
      { name: "Kottampatti", fee: 12000 },
      { name: "Pollachi", fee: 11000 },
      { name: "Vadakipalayam privu", fee: 10000 },
      { name: "Kovilpalayam", fee: 9000 },
      { name: "Thamaraikulam", fee: 8000 },
      { name: "Kinathukadavu", fee: 7000 }
    ]
  },
  {
    "route": "Saravanampatti (Via Ramanathapuram & Chettipalayam)",
    "busNo": "3",
    "stops": [
      { name: "Saravanampatti", fee: 18000 },
      { name: "Gandhipuram – Thiruvallur bus stand", fee: 17000 },
      { name: "Women’s polytechnic", fee: 16000 },
      { name: "Lakshmi mills", fee: 15000 },
      { name: "Ramanathapuram", fee: 14000 },
      { name: "Nanjundapuram GD tank", fee: 13000 },
      { name: "Chettipalayam", fee: 12000 },
      { name: "Panapatti pirivu", fee: 11000 },
      { name: "Vadasithur", fee: 10000 }
    ]
  },
  {
    "route": "Kovai pudur (Via Madukari Market)",
    "busNo": "4",
    "stops": [
      { name: "Kovaipudur", fee: 15000 },
      { name: "Sundakamuthur", fee: 14000 },
      { name: "Perur", fee: 13000 },
      { name: "Selvapuram", fee: 12000 },
      { name: "Puttuviki", fee: 11000 },
      { name: "Kuniamuthur High School", fee: 10000 },
      { name: "Madukkarai Quary Office", fee: 9000 },
      { name: "Madukkarai market", fee: 8000 },
      { name: "Malumichampatti", fee: 7000 },
      { name: "Kinathukadavu", fee: 6000 }
    ]
  },
  {
    "route": "Vadakkipalayam pirivu - Chenniyur (Via sulakkal)",
    "busNo": "5",
    "stops": [
      { name: "Vadakipalayam Pirivu", fee: 13000 },
      { name: "Ponnapuram pirivu", fee: 12000 },
      { name: "Vadakipalayam", fee: 11000 },
      { name: "Sulakkal", fee: 10000 },
      { name: "Chennaiyur", fee: 9000 },
      { name: "Sulakkal – Roots Company road", fee: 8000 },
      { name: "Thamaraikulam", fee: 7000 },
      { name: "Kinathukadavu", fee: 6000 }
    ]
  },
  {
    "route": "Sulur (Via Ramanathapuram)",
    "busNo": "6",
    "stops": [
      { name: "Sulur", fee: 14000 },
      { name: "Ondipudur", fee: 13000 },
      { name: "Siganallur", fee: 12000 },
      { name: "Sowripalayam", fee: 11000 },
      { name: "Puliyakulam", fee: 10000 },
      { name: "Ramanathapuram", fee: 9000 },
      { name: "Najundapuram", fee: 8000 },
      { name: "Chettipalayam – Vadasithur", fee: 7000 }
    ]
  },
  {
    "route": "Tirupur - GH (Via Old Bus stand,Mangalam)",
    "busNo": "9",
    "stops": [
      { name: "Kovil vazhi Bus stand", fee: 16000 },
      { name: "Old bus Stand", fee: 15000 },
      { name: "mangalam", fee: 14000 },
      { name: "63-Velampalayam", fee: 13000 },
      { name: "Palladam GH", fee: 12000 },
      { name: "Karaidivavi", fee: 11000 },
      { name: "Sellakarachal", fee: 10000 },
      { name: "Lakshiminaiyakanpalayam", fee: 9000 },
      { name: "Panapatti", fee: 8000 },
      { name: "Panapatti pirivu", fee: 7000 },
      { name: "Vadasithur", fee: 6000 }
    ]
  },
  {
    "route": "Dhali (Via Negamam)",
    "busNo": "11",
    "stops": [
      { name: "Kurichikottai", fee: 17000 },
      { name: "Dhali", fee: 16000 },
      { name: "Erichanampaatti", fee: 15000 },
      { name: "Kondigiyam", fee: 14000 },
      { name: "Udukkampalayam", fee: 13000 },
      { name: "Lakshmapuram", fee: 12000 },
      { name: "Kedimedu", fee: 11000 },
      { name: "Singuvadai", fee: 10000 },
      { name: "Poosaripatti", fee: 9000 },
      { name: "Negamam", fee: 8000 },
      { name: "Cheetipudur", fee: 7000 },
      { name: "Vadasithur", fee: 6000 }
    ]
  },
  {
    "route": "Pollachi (Via Negemam)",
    "busNo": "12",
    "stops": [
      { name: "Pollachi Their Nilayam", fee: 10000 },
      { name: "Puliyampatti", fee: 9000 },
      { name: "Negamam", fee: 8000 },
      { name: "Vadasithur", fee: 7000 }
    ]
  }
];
//keep it here for High Cohesion
const seedTransport = async () => {
  const docs = [];

  data.forEach(r => {
    r.stops.forEach(stopObj => {
      docs.push({
        route: r.route,
        busNo: r.busNo,
        stop: stopObj.name,
        fee: stopObj.fee
      });
    });
  });

  if (!docs.length) return;

  const count = await Transport.countDocuments();
  if (count > 0) return;

  await Transport.insertMany(docs);
};

module.exports = { Transport, seedTransport };
