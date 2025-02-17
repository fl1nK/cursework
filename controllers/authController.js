const User = require('../models/User')
const Role = require('../models/Role')
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator')
const {secret} = require("../config")
const cookie = require('cookie');
const createPath = require('../helpers/create-path.js')
const PDFFile = require("../models/pdfFileModel");
const fs = require("fs");

const handleError = (res, status, error) => {
    //console.log(error);
    res.status(status)
    res.render(createPath('views/error.ejs'), { error: error });
};

const generateAccessToken = (id, roles) => {
    const payload = {
        id,
        roles
    }
    return jwt.sign(payload, secret, {expiresIn: "24h"} )
}

class authController {
    async registration(req, res) {
        try {
            const errors = validationResult(req).formatWith(({msg}) => msg)
            if (!errors.isEmpty()) {
                return handleError(res,400,errors.array())
            }
            const {username, password} = req.body;
            const candidate = await User.findOne({username})
            if (candidate) {
                return handleError(res,400,'Користувач з таким логіном уже існує')
            }
            const hashPassword = bcrypt.hashSync(password, 7);
            const userRole = await Role.findOne({value: "USER"})
            const user = new User({username, password: hashPassword, roles: [userRole.value]})
            await user.save()
            return res.redirect('/login')
        } catch (e) {
            console.log(e)
            return handleError(res,400,'Помилка при реєстрації')
        }
    }

    async login(req, res) {
        try {
            const {username, password} = req.body
            const user = await User.findOne({username})
            if (!user) {
                return handleError(res,400,`Користувач ( ${username} ) не знайдено`)
            }
            const validPassword = bcrypt.compareSync(password, user.password)
            if (!validPassword) {
                return handleError(res,400,`Введено невірний пароль`)
            }
            const token = generateAccessToken(user._id, user.roles)

            const usernameCookie = cookie.serialize('username', username)
            const tokenCookie = cookie.serialize('token', `Bearer ${token}`)
            res.setHeader('Set-Cookie', [usernameCookie, tokenCookie],{
                httpOnly: true,
                maxAge: 60 * 60 * 24 // 1 day
            })
            return res.redirect('/patterns')

        } catch (e) {
            console.log(e)
            return handleError(res,400,`Помилка при вході`)
        }
    }

    async delete(req, res) {
        try {

            const cookies = cookie.parse(req.headers.cookie || '');
            const token = cookies.token.split(' ')[1]
            const {id: userid} = jwt.verify(token, secret)

            User
                .findByIdAndDelete({ _id: userid })
                .then((user) => {
                    PDFFile
                        .find({ _id: user.pdf } )
                        .then((patterns) => {
                            for(let i = 0; i < patterns.length; i++){
                                PDFFile
                                    .findByIdAndDelete(patterns[i].id)
                                    .then((params) => {
                                        const pathFile = createPath('./data/dataPatternPDF/' + params.filename )
                                        fs.unlink(pathFile, (err) => {
                                            if (err) throw err;
                                        });
                                    })
                                    .catch((error) => console.log(error));
                            }
                        })
                        .catch((error) => console.log(error));

                    res.redirect('/logout')
                })
                .catch((error) => console.log(error));

        } catch (e) {
            console.log(e)
            return handleError(res,500,`Помилка при видалені акаунту`)
        }
    }

}

module.exports = new authController()
