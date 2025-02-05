// require('dotenv').config()
import 'colors';
import nodemailer from 'nodemailer';
import { join } from 'path';
import 'dotenv/config';
import lodash from 'lodash';
const { merge } = lodash;
var log = (...messages) => console.log('[SMTP]', ...messages)

// mongoose
import mongoose from "mongoose";
await mongoose.connect(process.env.MONGO_URI + process.env.MONGO_DB)
    .then(() => log('mongo connected'.green, process.env.MONGO_DB))
import '@tomizap/mongoose-model'
import { resolveMx } from 'dns';

const transporterConfig = {
    host: process.env.SMTP_HOST || 'localhost',
    port: process.env.SMTP_PORT || 587,
    auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD
    },
    secure: false,
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000, // 10 seconds
    socketTimeout: 10000 // 10 seconds
}
const templatesDir = join('.', 'templates')
const partialsDir = join(templatesDir, 'partials')
const extNameTemplate = '.handlebars'
const hbsConfig = {
    viewEngine: {
        extName: extNameTemplate,
        partialsDir: partialsDir,
        layoutsDir: templatesDir,
        defaultLayout: false,
    },
    viewPath: templatesDir,
    extName: extNameTemplate,
}
const emailConfig = {
    from: process.env.SMTP_USERNAME,
    to: process.env.SMTP_USERNAME,
    template: "email",
    attachments: [],
    subject: "test",
    context: {
        html: "Ceci est un message de test",
        ux: {
            primary: "black",
        },
        company: {
            // name: 'Tomokan',
            // email: "contact@tomokan.io",
            // phone: "0756968335",
            links: {
                // website: 'https://tomokan.io',
                // logo: "https://tomokan.io/wp-content/uploads/2025/01/TO.png",
                // contact: 'https://tomokan.io/contact',
                // policy: 'https://tomokan.io/policy',
                // agenda: "https://calendar.app.google/usdH4P5kZMCB8oWm8",
                // linkedin: "https://www.linkedin.com/company/tomokan/",
                // // facebook: "https://www.facebook.com/p/LDeclic-100067230407489/",
                // instagram: "https://www.instagram.com/tomokan.agency/",
            }
        },
        user:
            await mongoose.model('users').findOne({ email: process.env.SMTP_USERNAME }) ??
            await mongoose.model('users').findOne({
                $or: [
                    { role: 'admin' },
                    { permissions: { $in: ['MASTER', 'ADMIN'] } },
                ]

            }),
    },
}

const transporter = nodemailer.createTransport(transporterConfig)
log('connected'.green, transporterConfig.auth.user)
const hbs = await import('nodemailer-express-handlebars');
transporter.use('compile', hbs.default(hbsConfig));

const sendMail = async (config) => {

    config = await merge(
        emailConfig,
        config
    )

    try {
        config.context.company = config.context.company.toJSON()
    } catch { '' }

    if (!config.context.user.name) {
        config.context.user = await mongoose.model('users').findOne({ email: process.env.SMTP_USERNAME })
    }
    try {
        config.context.user = config.context.user.toJSON()
    } catch { '' }
    if (config.context.user.name) {
        config.from = `${config.context.user.name} <${config.from}>`
    }

    try {
        const domain = config.to.split("@")[1];
        resolveMx(domain, async (err, addresses) => {
            if (err) {
                throw new Error(err)
            }
        });
    } catch (error) {
        console.log("ErrorSendEmail", error);
        return error
    }

    if (config.context.template) {
        let template = config.context.template
        if (template.context && !template._uuid && !template._id) {
            template = await mongoose.model('templates')
                .find({ context: template.context })
                .then(templates => templates.length === 0 ? null : templates[Math.floor(Math.random() * templates.length)])
        } else {
            template =
                await mongoose.model('templates')
                    .findOne({
                        $or: [
                            { _uuid: template._uuid },
                            { _id: template._id },
                        ]
                    })
        }
        if (template !== null) {
            config.context.html = await template.compil(config.context)
            if (template.title) config.subject = template.title
            config.context.template = template
        }
    }

    // console.log(config)
    const log = await new mongoose.model('logs')({ request: {}, response: {} }).save()
    if (config.context.company?.links?.api) {
        config.context.cb_open_url = `${config.context.company.links.api}/logs/open/${log._id}`
    }
    const response = await transporter.sendMail(config)
    log.response.opened = false
    await log.save()
    console.log('Message sent: '.green, config.to)
    return response

}

const multiSend = async (collection, emailConfig) => {

    const contacts = await mongoose.model(collection).find({
        email: { $exists: true, $ne: null },
        status: { $in: ['lead', 'prospect', 'new', ''] },
        $or: [
            { lastEmailAt: { $exists: false } },
            { lastEmailAt: { $lt: new Date(new Date().setDate(new Date().getDate() - 7)) } }
        ]
    }, '_id name', { limit: 99999 });
    console.log(contacts.length, "contacts");

    for (let contact of contacts) {
        const index = contacts.indexOf(contact);

        try {

            contact = await mongoose.model(collection).findById(contact._id);

            const now = new Date();
            const dayOfWeek = now.getDay();
            const hour = now.getHours();
            // console.log("dayOfWeek", dayOfWeek, "hour", hour);
            if (dayOfWeek === 0 || dayOfWeek === 6 || hour < 9 || hour >= 20) {
                console.log("Hors plage horaire, attente 1 heur ...".red);
                await new Promise(resolve => setTimeout(resolve, 3600000));
                continue
            }

            if (contact.lastEmailAt && contact.lastEmailAt > new Date(new Date().setDate(new Date().getDate() - 7))) {
                console.log("too early".red, contact.name);
                continue
            }

            // console.log("sendMail", contact.email);
            await sendMail({ ...emailConfig, to: contact.email });
            await mongoose.model(collection).updateMany(
                { email: contact.email },
                { $set: { lastEmailAt: new Date() } }
            );
            console.log('email sent'.green, `${index + 1}/${contacts.length}`.yellow, contact.name);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Espacement entre chaque envoi

        } catch (error) {

            console.log("ErrorMultiSendItem", error);

        }

    }

    console.log("multiSend end".green);

}

export { sendMail, transporter, multiSend }