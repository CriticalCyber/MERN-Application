const express = require('express');
const { 
    getAllTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    toggleTemplateStatus
} = require('../controllers/notificationTemplateController');
const { isAuthenticatedUser } = require('../middlewares/userAuth.middleware');
const { isAuthenticatedAdmin } = require('../middlewares/adminAuth.middleware');

const router = express.Router();

router.route('/notification-templates')
    .get(isAuthenticatedAdmin, getAllTemplates)
    .post(isAuthenticatedAdmin, createTemplate);

router.route('/notification-template/:id')
    .get(isAuthenticatedAdmin, getTemplate)
    .put(isAuthenticatedAdmin, updateTemplate)
    .delete(isAuthenticatedAdmin, deleteTemplate);

router.route('/notification-template/:id/toggle')
    .put(isAuthenticatedAdmin, toggleTemplateStatus);

module.exports = router;