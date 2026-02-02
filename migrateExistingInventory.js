const mongoose = require('mongoose');
const Product = require('./models/productModel');
const Inventory = require('./models/inventoryModel');
const { updateProductActiveStatus } = require('./services/inventoryService');

// Load environment variables
require('dotenv').config({ path: '.env' });

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const migrateExistingInventory = async () => {
    try {
        console.log('Starting inventory migration for existing products...');

        // Find all products that don't have an associated inventory record
        const products = await Product.find({});
        console.log(`Found ${products.length} products to process`);

        let processedCount = 0;
        let createdCount = 0;
        let skippedCount = 0;

        for (const product of products) {
            try {
                // Check if inventory record already exists for this product
                const existingInventory = await Inventory.findOne({ product: product._id });
                
                if (existingInventory) {
                    console.log(`Skipping product ${product.name} - inventory already exists`);
                    skippedCount++;
                    continue;
                }

                // Create inventory record for the product
                const inventory = new Inventory({
                    product: product._id,
                    sku: product.sku || `SKU-${product._id.toString().substring(0, 8).toUpperCase()}`,
                    quantityAvailable: product.stock || 0,  // Use existing stock field as initial available quantity
                    quantityReserved: 0,  // No reserved stock initially
                    reorderLevel: 10  // Default reorder level
                });

                await inventory.save();
                console.log(`Created inventory for product: ${product.name} (ID: ${product._id})`);
                
                // Update product active status based on inventory levels
                await updateProductActiveStatus(product._id);
                
                createdCount++;
                processedCount++;
                
                // Log progress every 10 products
                if (processedCount % 10 === 0) {
                    console.log(`Processed ${processedCount}/${products.length} products...`);
                }
            } catch (error) {
                console.error(`Error processing product ${product.name} (${product._id}):`, error.message);
            }
        }

        console.log('\nMigration Summary:');
        console.log(`- Total products processed: ${processedCount}`);
        console.log(`- Inventory records created: ${createdCount}`);
        console.log(`- Products skipped (already had inventory): ${skippedCount}`);
        console.log(`- Products with errors: ${products.length - processedCount}`);

        console.log('\nInventory migration completed successfully!');
    } catch (error) {
        console.error('Error during inventory migration:', error.message);
        process.exit(1);
    }
};

const runMigration = async () => {
    await connectDB();
    await migrateExistingInventory();
    mongoose.connection.close();
    console.log('Database connection closed.');
};

// Run the migration
if (require.main === module) {
    runMigration();
}

module.exports = { migrateExistingInventory };