import 'dotenv/config';

// mongoose
import mongoose from "mongoose";
await mongoose.connect(process.env.MONGO_URI + process.env.MONGO_DB)
    .then(() => console.log('mongo connected'.green, process.env.MONGO_DB))
import '@tomizap/mongoose-model'

await new mongoose.model('templates')({
    name: "infomational_9",
    _uuid: "infomational_9",
    title: '🚀 Des talents à portée de main !',
    context: 'sailing',
    html: ` 
        <p>Bonjour,</p> 
        <p>Pourquoi chercher plus loin ? Nous avons déjà des candidats compétents prêts à intégrer votre équipe. 💼</p>
        <p>Notre service est simple, rapide et totalement <strong>gratuit</strong>. Ne passez pas à côté !</p>
        <p><a class="cta" href="{{company.links.contact}}">Contactez-nous dès maintenant</a></p>
        <p>Cordialement,</p>
    `,
}).save()