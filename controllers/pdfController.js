const PDFFile = require("../models/pdfFileModel");
const User = require("../models/User");
const path = require("path");
const fs = require('fs')
const cookie = require("cookie");
const jwt = require("jsonwebtoken");
const {secret} = require("../config");
const {getValuePdf} = require('../helpers/tools-pdf')
const createPath = require('../helpers/create-path.js')

const handleError = (res, status, error) => {
    //console.log(error);
    res.status(status)
    res.render(createPath('views/error.ejs'), { error: error });
};

const getUserIdFromCookies = (req) => {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.token.split(' ')[1]
    const {id: userid} = jwt.verify(token, secret)
    return userid
}

const addPDF = (req, res) => {

        if (!req.files) {
            return handleError(res,400,'Файл не завантажено')
        }

        const file = req.files.pdfFile;
        const filename = Date.now()+'-'+file.name
        const extensionName = path.extname(filename);
        const allowedExtension = ['.pdf'];

        if(!allowedExtension.includes(extensionName)){
            return handleError(res,422,'Завантаженно некоректний файл')
        }
        const pathFile = createPath('./data/dataPatternPDF/' + filename )


        file.mv(pathFile, (err) => {
            if (err) {
                return handleError(res,500,err)
            }

            getValuePdf(filename).then(values => {
                if (!values.length) {
                    fs.unlink(pathFile, (err) => {
                        if (err) return handleError(res,500,err)
                    });
                    return handleError(res,422,'В шаблоні повина бути хоча б одна форма')
                }

                const userid = getUserIdFromCookies(req)

                const {name} = req.body;

                const pdfFile = new PDFFile({ name, filename, values });
                pdfFile
                    .save()
                    .then((file) => {
                        User
                            .findByIdAndUpdate(userid, {$push:{pdf: file._id}})
                            .then(() => res.redirect('/patterns-by-user'))
                            .catch((error) => console.log(error));
                    })
                    .catch((error) => console.log(error));
            })
        });
}

const getPatterns = (req, res) => {
    User
        .find({ roles: ['ADMIN'] })
        .then((user) => {
            PDFFile
                .find({ _id: user[0].pdf } )
                .then((patterns) => res.render(createPath('views/patterns.ejs'),{patterns}))
                .catch((error) => console.log(error));
        })
        .catch((error) => console.log(error));
}

const getPatternsByUserID = (req, res) => {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.token.split(' ')[1]
    const {id: userid} = jwt.verify(token, secret)
    User
        .findById(userid)
        .then((user) => {
            PDFFile
                .find({ _id: user.pdf } )
                .then((patterns) => res.render(createPath('views/patterns-by-user.ejs'),{patterns}))
                .catch((error) => console.log(error));
        })
        .catch((error) => console.log(error));
}

const getPattern = (req, res) => {
    PDFFile
        .findById(req.params.id)
        .then((pattern) => res.render(createPath('views/pattern.ejs'),{pattern}))
        .catch((error) => console.log(error));
}

const getPDF = (req, res) => {
    res.render(createPath('./views/addPDF.ejs'))
}

const deletePDF = (req, res) => {

    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.token.split(' ')[1]
    const {id: userid} = jwt.verify(token, secret)

    const {fileid} = req.body;

    User
        .findByIdAndUpdate(userid, {$pullAll: {pdf: [{_id: fileid}],},})
        .then()
        .catch((error) => console.log(error));

    User
        .findByIdAndUpdate(userid, {$pullAll: {favorites: [{_id: fileid}],},})
        .then()
        .catch((error) => console.log(error));

    PDFFile
        .findByIdAndDelete(fileid)
        .then((params) => {
            const pathFile = createPath('./data/dataPatternPDF/' + params.filename )
            fs.unlink(pathFile, (err) => {
                if (err) throw err;
                res.redirect('/patterns-by-user')
            });
        })
        .catch((error) => console.log(error));
}


const addFavoritesPDF = (req, res) => {

    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.token.split(' ')[1]
    const {id: userid} = jwt.verify(token, secret)

    const {fileid} = req.body;

    User
        .findByIdAndUpdate(userid, {$addToSet:{favorites: fileid}})
        .then(() => res.redirect('/patterns-favorites'))
        .catch((error) => console.log(error));
}

const getFavoritesPDF = (req, res) => {

    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.token.split(' ')[1]
    const {id: userid} = jwt.verify(token, secret)

    User
        .findById(userid)
        .then((user) => {
            PDFFile
                .find({ _id: user.favorites } )
                .then((patterns) => res.render(createPath('views/patterns-favorites.ejs'),{patterns}))
                .catch((error) => console.log(error));
        })
        .catch((error) => console.log(error));
}

const deleteFavotitesPDF = (req, res) => {

    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.token.split(' ')[1]
    const {id: userid} = jwt.verify(token, secret)

    const {fileid} = req.body;

    User
        .findByIdAndUpdate(userid, {$pullAll: {favorites: [{_id: fileid}],},})
        .then(() => res.redirect('/patterns-favorites'))
        .catch((error) => console.log(error));

}

module.exports  ={
    addPDF,
    getPDF,
    deletePDF,
    addFavoritesPDF,
    getFavoritesPDF,
    deleteFavotitesPDF,
    getPatternsByUserID,
    getPatterns,
    getPattern
}