const mongoose = require('mongoose');
const Category = require('../models/categoryModel');

class SearchFeatures {
    constructor(query, queryString) {
        this.query = query
        this.queryString = queryString
    }

    search() {
        if (this.queryString.keyword) {
            // Use text search for better performance
            this.query = this.query.find({ $text: { $search: this.queryString.keyword } });
        }
        return this;
    }

    async prepareFilters() {
        const queryCopy = { ...this.queryString }

        // fields to remove for category
        const removeFields = ["keyword", "page", "limit"];

        // console.log(queryCopy);
        removeFields.forEach(key => delete queryCopy[key]);
        // console.log(queryCopy);

        // Handle category filter - convert name/slug to ObjectId
        if (queryCopy.category) {
            // Check if category is already an ObjectId
            if (mongoose.Types.ObjectId.isValid(queryCopy.category)) {
                // It's already an ObjectId, use as is
                this.processedCategory = mongoose.Types.ObjectId(queryCopy.category);
            } else {
                // It's a category name or slug, find the corresponding ObjectId
                const category = await Category.findOne({
                    $or: [
                        { name: { $regex: new RegExp(`^${queryCopy.category}$`, 'i') } },
                        { slug: { $regex: new RegExp(`^${queryCopy.category}$`, 'i') } }
                    ]
                });
                
                if (category) {
                    this.processedCategory = category._id;
                } else {
                    // If category doesn't exist, set to an empty ObjectId to return no results
                    this.processedCategory = mongoose.Types.ObjectId('000000000000000000000000');
                }
            }
        }

        // Store status filter separately to handle it in filter() method
        this.statusFilter = queryCopy.status;
        delete queryCopy.status;
        
        // price filter
        let queryString = JSON.stringify(queryCopy);
        queryString = queryString.replace(/\b(gt|gte|lt|lte)\b/g, key => `$${key}`);
        
        this.processedFilters = JSON.parse(queryString);
        
        return this;
    }
    
    filter() {
        // Apply the pre-processed filters
        if (this.processedCategory !== undefined) {
            this.processedFilters.category = this.processedCategory;
        }
        
        if (this.processedFilters) {
            this.query = this.query.find(this.processedFilters);
        }
        
        // Handle status filter using inventory system
        if (this.statusFilter) {
            // For inventory-based status filtering, we need to modify the query
            // This will be handled by the main controller with proper joins
            if (this.statusFilter === 'in-stock') {
                this.statusFilterValue = 'in-stock';
            } else if (this.statusFilter === 'out-of-stock') {
                this.statusFilterValue = 'out-of-stock';
            }
        }
        
        return this;
    }

    sort() {
        if (this.queryString.sort) {
            const sortBy = this.queryString.sort.split(',').join(' ');
            this.query = this.query.sort(sortBy);
        } else {
            // Default sort by createdAt descending
            this.query = this.query.sort('-createdAt');
        }
        return this;
    }

    limitFields() {
        if (this.queryString.fields) {
            const fields = this.queryString.fields.split(',').join(' ');
            this.query = this.query.select(fields);
        }
        return this;
    }

    pagination(resultPerPage) {
        const currentPage = Number(this.queryString.page) || 1;

        const skipProducts = resultPerPage * (currentPage - 1);

        this.query = this.query.limit(resultPerPage).skip(skipProducts);
        return this;
    }
};

module.exports = SearchFeatures;