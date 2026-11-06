const router = require("express").Router();
const CategoryController = require("../category/category.controller");

router.get("/public", CategoryController.getPublicMenu);
router.get("/addon-offers", CategoryController.getAddonOffers);

module.exports = router;
