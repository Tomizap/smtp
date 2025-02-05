import { multiSend, sendMail } from "./transporter.mjs";

await multiSend('companies', {
    from: "contact@alter-recrut.fr",
    to: "zaptom.pro@gmail.com",
    template: "email",
    context: {
        template: {
            // _uuid: 'infomational_1',
            context: 'sailing',
        },
        ux: {
            // primary: '#FFD100'
        },
        company: {
            name: 'Alter Recrut',
            email: "contact@alter-recrut.fr",
            title: "Cabinet de recrutement spécialisé dans l'alternance",
            phone: "0756987385",
            links: {
                website: 'https://alter-recrut.fr',
                logo: "https://alter-recrut.fr/wp-content/uploads/2024/05/Logo-Alter-recrut-Transparent-1024x1024.png",
                contact: 'https://alter-recrut.fr/contact',
                policy: 'https://alter-recrut.fr/mentions-legales/',
                agenda: "https://calendar.app.google/6ihSXjrvMfXwuLFw5",
                linkedin: "https://www.linkedin.com/company/alter-recrut/?viewAsMember=true",
                facebook: "https://www.facebook.com/alter.recrut/",
                instagram: "https://www.instagram.com/alter.recrut/",
            }
        },
    }
})