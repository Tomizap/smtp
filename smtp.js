/* eslint-disable no-undef */
require('dotenv').config()
require('colors')
const nodemailer = require('nodemailer')
const path = require('path');
const process = require('process')
const lodash = require('lodash');
const express = require('express');
const { auth } = require('../mongo/mongo');
const { default: mongoose } = require('mongoose');
const log = (...messages) => console.log('[SMTP]', ...messages)
const BASE_URL = (process.env.API_NAMESPACE || '/api/v1') + '/smtp'
function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters.charAt(randomIndex);
    }
    return result;
}

let transporterConfig = {
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
let templatesDir = path.join(__dirname, 'templates')
let partialsDir = path.join(templatesDir, 'partials')
let extNameTemplate = '.handlebars'
let hbsConfig = {
    viewEngine: {
        extName: extNameTemplate,
        partialsDir: partialsDir,
        layoutsDir: templatesDir,
        defaultLayout: false,
    },
    viewPath: templatesDir,
    extName: extNameTemplate,
}
let emailConfig = {
    from: process.env.SMTP_USERNAME,
    to: process.env.SMTP_USERNAME,
    template: "email",
    attachments: [],
    subject: "test",
    context: {
        message: "Hello !",
        ux: {
            primary: "black",
        },
        company: {
            // name: 'SMTP',
            // email: "t.zapico@alter-recrut.fr",
            // phone: "0665774180",
            links: {
                // website: 'https://ldeclic.fr',
                // logo: "https://www.ldeclic.fr/wp-content/uploads/2022/12/cropped-LDeclic-OFF.png",
                // contact: 'https://ldeclic.fr/contact',
                // policy: 'https://ldeclic.fr/policy',
                // agenda: "https://calendar.app.google/qr85RTnMiatinr598",
                // linkedin: "https://www.linkedin.com/company/ldeclic/",
                // facebook: "https://www.facebook.com/p/LDeclic-100067230407489/",
                // instagram: "https://www.instagram.com/ldeclic_/",
            }
        },
        user: {}
    },
}

module.exports.setup = async (app = express()) => {

    log('setup ..'.grey)

    let transporter = nodemailer.createTransport(transporterConfig)
    log('connected'.green, transporterConfig.auth.user)
    const hbs = await import('nodemailer-express-handlebars');
    transporter.use('compile', hbs.default(hbsConfig));

    app.set('emailTransporter', transporter)

    app.use((req, res, next) => {

        req.sendMail = async (config) => {

            config = await lodash.merge(
                emailConfig,
                config
            )

            // sender
            // config.from = config.context?.user?.name || config.context.company.name || ''
            // if (await config.context?.user?.email?.includes(process.env.SMTP_USERNAME.split('@')[1])) {
            //     config.from += `<${config.context.user.email}>`
            // } else {
            //     config.from += `<${process.env.SMTP_USERNAME}>`
            // }  

            // map field
            try {
                config.context.company.links =
                    Object.fromEntries(config.context.company.links)
            } catch (error) { log("SmtpSendError", error) }
            try {
                config.context.user.links =
                    Object.fromEntries(config.context.user.links)
            } catch (error) { log("SmtpSendError", error) }

            console.log('config', config);

            await transporter.sendMail(config)
            log(`EmailSent: ${config.to}`.green)

        }

        next()

    })

    log('OK !'.green)

    return app

}

module.exports.server = async (app = express()) => {

    app.post(BASE_URL + "/code", async (req, res) => {
        // try {
        let { user, email } = req.body
        user = await mongoose.model('users').findOne({ email: user.email })
        if (user === null) throw new Error(user.email + " n'existe pas")
        const code = generateRandomString(6)
        await mongoose.model('tokens').refresh({
            owner: user._id,
            cypher: code,
            context: "smtp_code"
        })
        email.to = user.email
        email.template = 'info'
        if (!email.context) email.context = {}
        email.context.html = await mongoose.model('templates').findOne({
            _uuid: "code_fr"
        }).then(async r => await r.compil({ user, code }))
        await req.smtp.send(email)
        res.success({ message: "Un email a été envoyé à " + user.email })
        // } catch (error) {
        //     error.name = 'SendSmtpCodeError'
        //     res.error(error)
        // }
    })

    app.post(BASE_URL + '/confirm-code', auth, async (req, res) => {
        let { responseToken } = req.body
        req.user.emailVerified = true
        await req.user.save()
        if (responseToken) {
            await mongoose.model('templates').refresh(responseToken)
        }
        res.success({ message: 'Code confirmé' })
    })

    app.post(BASE_URL + '/unsubscribe', auth, async (req, res) => {
        const { type = 'companies', email } = req.body
        const contacts = await mongoose.model(type).find({ email })
        for (let index = 0; index < contacts.length; index++) {
            contacts[index].status = 'disqualified'
        }
        await mongoose.model(type).bulkSave(contacts)
        res.success({ message: `${email} has been disqualified` })
    })

    app.post("/api/v1/smtp/send", auth, async (req, res) => {
        try {
            const email = req.body
            if (!email.context.user) email.context.user = req.user.toJSON()
            if (!email.context.company) email.context.company = app.get('project')?.company.toJSON()


            await req.sendMail(email)
            res.success({ message: 'Email has been sent !' })
        } catch (error) {
            return res.error(error)
        }
    })

}