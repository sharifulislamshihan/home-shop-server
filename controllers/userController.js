const createError = require('http-errors');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/userModel');
const { successResponse } = require('./responseController');
const { findWithId } = require('../Services/findWithId');
const { createJsonWebToken } = require('../helper/jsonwebtoken');
const { jwtActivationKey, clientUrl, jwtResetPasswordKey } = require('../secret');
const { sendEmailWithNodeMailer } = require('../helper/email');
const { handleUserAction, findUser, findUserById, deleteUserById, updateUserPasswordById, } = require('../Services/userService');
const createHttpError = require('http-errors');
const { error } = require('console');


// get all the user
const getUsers = async (req, res, next) => {
    try {
        const search = req.query.search || "";
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const { users, pagination } = await findUser(search, limit, page);

        return successResponse(res, {
            statusCode: 200,
            message: "Users Returned Successfully",
            payload: {
                users,
                pagination: pagination,
            }
        })
    }
    catch (error) {
        next(error);
    }
}


// get a single user
const getUserById = async (req, res, next) => {

    try {
        // console.log(req.user);
        const id = req.params.id;
        const options = {
            password: 0,
        }
        const user = await findUserById(id, options);

        return successResponse(res, {
            statusCode: 200,
            message: "Users Returned Successfully",
            payload: {
                user
            }
        })
    }
    catch (error) {
        next(error);
    }
}

// delete a single user
const handleDeleteUserById = async (req, res, next) => {
    try {
        const id = req.params.id;
        const options = {
            password: 0,
        }
        await deleteUserById(id, options);

        // const userImagePath = user.image;
        // fs.access(userImagePath, (err) =>{
        //     if(err){
        //         console.log("User Image does not exist...");
        //     } else {
        //         // file exists
        //         fs.unlink(userImagePath, (err) =>{
        //             if(err) throw err;
        //             console.log('Successfully deleted User Image');
        //         });
        //     };
        // })
        return successResponse(res, {
            statusCode: 200,
            message: "User Deleted Successfully",
        })
    }
    catch (error) {
        next(error);
    }
}

// process  registration request create account
const processRegister = async (req, res, next) => {
    try {
        const { name, email, password, image, phone, address } = req.body;
        //todo: 'add image and store image form imgbb';
        // check if the user already exists in the database
        const userExists = await User.exists({
            email: email
        });

        if (userExists) {
            throw createError(409, 'User with this  Email already Exists. Please sign in');
        }

        // jwt
        const token = createJsonWebToken(
            { name, email, password, image, phone, address }, jwtActivationKey,
            '10m')

        //console.log(token);
        // const newUser = {
        //     name,
        //     email,
        //     password,
        //     phone,
        //     address
        // }


        // Prepare Email
        const emailData = {
            email,
            subject: 'Account Verification Mail',
            html: `
            <h2>Hello ${name}</h2>
            <p>Thank you for registering at our Home Shop.</p>
            <p>Please click on the following link to verify your account</p>
            <a href="${clientUrl}/api/users/activate/${token}" target="_blank">Verify Account</a>
            `
        }

        //  Send Email with Nodemailer
        try {
            //todo: uncommnet below line 
            //await sendEmailWithNodeMailer(emailData)
        } catch (error) {
            next(createError(500, "Failed to send verification mail"));

            return;
        }

        return successResponse(res, {
            statusCode: 200,
            message: `Please go to at ${email} to completing your registration email`,
            // todo : comment below payload line
            payload: {
                token
            }
        })
    }
    catch (error) {
        next(error);
    }
}

// activate user account req to verify email and save in db
const activateUserAccount = async (req, res, next) => {
    try {
        const token = req.body.token;
        if (!token) throw createError(404, "Token is required");

        try {
            // verify the user using token
            const decoded = jwt.verify(token, jwtActivationKey);
            if (!decoded) throw createError(404, 'user was not able to verify')

            // check if the user already exists in the database
            const userExists = await User.exists({
                email: decoded.email
            });

            if (userExists) {
                throw createError(409, 'User with this  Email already Exists. Please try with new email');
            }

            // create user
            await User.create(decoded);
            console.log(decoded);
            return successResponse(res, {
                statusCode: 201,
                message: `user registered successfully`,
            })
        }
        catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw createError(401, 'This link has expired');
            }
            else if (error.name === 'JsonWebTokenError') {
                throw createError(401, 'Invalid or malformed token');
            }
            else {
                throw error;
            }
        }
    }
    catch (error) {
        next(error);
    }
}


// Update a single user
const handleUpdateUserById = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const options = { password: 0 };

        // find user
        const user = await findWithId(User, userId, options)

        const updateOptions = {
            // updated data should be original data
            new: true,
            // it helps to validate data according to schema
            runValidators: true,
            context: 'query',
        }

        let updates = {};
        // name, email, password, phone, image, address

        // --------------Update user data-----------------
        if (req.body.name) {
            updates.name = req.body.name;
        }
        // if (req.body.email) {
        //     updates.email = req.body.email;
        // }
        if (req.body.password) {
            updates.password = req.body.password;
        }
        if (req.body.phone) {
            updates.phone = req.body.phone;
        }
        // todo : image will update according to imgbb link
        if (req.body.image) {
            updates.image = req.body.image;
        }
        if (req.body.address) {
            updates.address = req.body.address;
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updates,
            updateOptions
        )
            //remove password from response
            .select("-password");

        if (!updatedUser) {
            throw createError(404, 'User does not exist')
        }

        return successResponse(res, {
            statusCode: 200,
            message: "User Updated Successfully",
            payload: {
                updatedUser,
            }
        })
    }
    catch (error) {
        // to handle mongoose cast error if any id is not valid
        if (error instanceof mongoose.Error.CastError) {
            throw createError(400, "Invalid ID")
        }
        next(error);
    }
}


// Update a single user
const handleUpdatePassword = async (req, res, next) => {
    try {

        // email, oldPassword, newPassword, confirmPassword will be received from req.body
        const { email, oldPassword, newPassword, confirmPassword } = req.body;
        const userId = req.params.id;

        const updateUser = await updateUserPasswordById(userId, email, oldPassword, newPassword, confirmPassword,)

        return successResponse(res, {
            statusCode: 200,
            message: "Password Updated Successfully",
            payload: {
                updateUser,
            }
        })
    }
    catch (error) {
        // to handle mongoose cast error if any id is not valid
        if (error instanceof mongoose.Error.CastError) {
            throw createError(400, "Invalid ID")
        }
        next(error);
    }
}

// forget Password 
const handleForgetPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email: email });
        if (!user) {
            throw createError(404, "User Not Found");
        }
        // jwt
        const token = createJsonWebToken(
            { email }, jwtResetPasswordKey,
            '10m');

        // Prepare Email
        const emailData = {
            email,
            subject: 'Reset Password Mail',
            html: `
                    <h2>Hello ${user.name}</h2>
                    <p>Please click on the following link to verify your account reset password</p>
                    <a href="${clientUrl}/api/users/reset-password/${token}" target="_blank">RESET PASSWORD</a>
                    `
        }
        //  Send Email with Nodemailer
        try {

            await sendEmailWithNodeMailer(emailData)
        } catch (error) {
            next(createError(500, "Failed to send reset password mail"));

            return;
        }

        return successResponse(res, {
            statusCode: 200,
            message: `Please go to your ${email} for reseting your password`,
            payload: {
                token
            }
        })
    }
    catch (error) {
        next(error);
    }
}

// forget Password 
const handleResetPassword = async (req, res, next) => {
    // todo:
    //     ----Fetch the token and password from request body
    //      ----Verify the token
    //      ----If the decoded is empty send error message
    //      ---- find and update the pass
    //      ----- id update unsuccessful send error message
    //      ---- if successful send success message
    try {
        const {token, password} = req.body;
        const userId = req.params.id;
        const decoded = jwt.verify(token, jwtResetPasswordKey);
        if (!decoded){
            throw createError(400, 'Invalid/expire token')
        }
        
        // fetching email from decoded and will use it
        const filter =  {email: decoded.email};
        
        const updatedUser = await User.findOneAndUpdate(
            filter,
            { password: password },
            { new: true }
        ).select('-password')

        if(!updatedUser) {
            throw createError(400, 'Password Reset Failed')
        }

        return successResponse(res, {
            statusCode: 200,
            message: 'Password Reset Successfully',
            payload: {
            }
        })
    }
    catch (error) {
        next(error);
    }
}


// handle ban and unbanned user by id
const handleManageBannedUserById = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const action = req.body.action
        console.log(action);

        // handle user action made to handle user ban unban action
        const successMessage = await handleUserAction(userId, action)
        return successResponse(res, {
            statusCode: 200,
            message: successMessage,
            payload: {
                User,
            }
        })
    }
    catch (error) {
        next(error);
    }
}

module.exports = {
    getUsers,
    getUserById,
    handleDeleteUserById,
    processRegister,
    activateUserAccount,
    handleUpdateUserById,
    handleManageBannedUserById,
    handleUpdatePassword,
    handleForgetPassword,
    handleResetPassword,
};