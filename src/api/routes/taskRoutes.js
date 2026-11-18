const { Router } = require('express');
const taskController = require('../controllers/taskController');
const validate = require('../validation/validate');
const schemas = require('../validation/taskSchemas');

const router = Router();

router.get('/', validate(schemas.list), taskController.list);
router.post('/', validate(schemas.create), taskController.create);
router.patch('/:id', validate(schemas.patch), taskController.patch);
router.put('/:id', validate(schemas.replace), taskController.replace);
router.delete('/:id', validate(schemas.remove), taskController.remove);

module.exports = router;
