import axios from 'axios';
import mongoose from 'mongoose';
import BookBox from "../models/bookbox.model";
import User from "../models/user.model";
import Request from "../models/book.request.model";
import Transaction from "../models/transaction.model";
import {notifyUser} from "./user.service";
import {newErr} from "./utilities";
import { 
    BookSearchQuery,
    IBook,
    ITransaction
} from '../types/book.types';
import { IUser } from '../types/user.types';
import { AuthenticatedRequest } from '../types/common.types';

const bookService = {

    async getBookInfoFromISBN(request: { params: { isbn: string } }) {
        const isbn = request.params.isbn;
        const response = await axios.get(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${process.env.GOOGLE_BOOKS_API_KEY}`);
        if (response.data.totalItems === 0) {
            throw newErr(404, 'Book not found');
        }
        const bookInfo = response.data.items[0].volumeInfo;
        const parutionYear = bookInfo.publishedDate ? parseInt(bookInfo.publishedDate.substring(0, 4)) : undefined;
        const pageCount = bookInfo.pageCount ? parseInt(bookInfo.pageCount) : undefined;
        return {
            isbn: isbn,
            title: bookInfo.title || 'Unknown title',
            authors: bookInfo.authors || ['Unknown author'],
            description: bookInfo.description || 'No description available',
            coverImage: bookInfo.imageLinks?.thumbnail || 'No thumbnail available',
            publisher: bookInfo.publisher || 'Unknown publisher',
            parutionYear: parutionYear,
            categories: bookInfo.categories || ['Uncategorized'],
            pages: pageCount,
        };
    },

    // Function that searches for books across all bookboxes based on keyword search and ordering filters
    // Optimized using MongoDB aggregation pipeline for better performance
    async searchBooks(request: { query: BookSearchQuery }) {
        const { kw, cls = 'by title', asc = true } = request.query;

        // Build aggregation pipeline
        const pipeline: any[] = [
            // Unwind the books array to work with individual books
            { $unwind: '$books' },
            
            // Add bookbox information to each book
            {
                $addFields: {
                    'books.bookboxId': { $toString: '$_id' },
                    'books.bookboxName': '$name'
                }
            }
        ];

        // Add keyword filtering stage if keyword is provided
        if (kw) {
            // Use text search if available, otherwise use regex
            pipeline.push({
                $match: {
                    $or: [
                        { 'books.title': { $regex: kw, $options: 'i' } },
                        { 'books.authors': { $regex: kw, $options: 'i' } },
                        { 'books.categories': { $regex: kw, $options: 'i' } }
                    ]
                }
            });
        }

        // Add sorting stage
        let sortField: string;
        let sortOrder = asc ? 1 : -1;

        switch (cls) {
            case 'by title':
                sortField = 'books.title';
                break;
            case 'by author':
                sortField = 'books.authors';
                break;
            case 'by year':
                sortField = 'books.parutionYear';
                break;
            case 'by recent activity':
                sortField = 'books.dateAdded';
                break;
            default:
                sortField = 'books.title';
        }

        pipeline.push({ $sort: { [sortField]: sortOrder } });

        // Project the final structure
        pipeline.push({
            $project: {
                _id: { $toString: '$books._id' },
                isbn: { $ifNull: ['$books.isbn', 'Unknown ISBN'] },
                title: '$books.title',
                authors: { $ifNull: ['$books.authors', []] },
                description: { $ifNull: ['$books.description', 'No description available'] },
                coverImage: { $ifNull: ['$books.coverImage', 'No cover image available'] },
                publisher: { $ifNull: ['$books.publisher', 'Unknown publisher'] },
                categories: { $ifNull: ['$books.categories', ['Uncategorized']] },
                parutionYear: '$books.parutionYear',
                pages: '$books.pages',
                dateAdded: { $ifNull: ['$books.dateAdded', new Date()] },
                bookboxId: '$books.bookboxId',
                bookboxName: '$books.bookboxName'
            }
        });

        // Execute the aggregation pipeline
        const results = await BookBox.aggregate(pipeline);
        
        return results;
    },

    async getBook(id: string) {
        // Use aggregation pipeline to efficiently find book by ID
        const pipeline = [
            // Unwind the books array
            { $unwind: '$books' },
            
            // Match the specific book ID
            { $match: { 'books._id': new mongoose.Types.ObjectId(id) } },
            
            // Project the result with bookbox information
            {
                $project: {
                    _id: { $toString: '$books._id' },
                    isbn: { $ifNull: ['$books.isbn', 'Unknown ISBN'] },
                    title: '$books.title',
                    authors: { $ifNull: ['$books.authors', []] },
                    description: { $ifNull: ['$books.description', 'No description available'] },
                    coverImage: { $ifNull: ['$books.coverImage', 'No cover image available'] },
                    publisher: { $ifNull: ['$books.publisher', 'Unknown publisher'] },
                    categories: { $ifNull: ['$books.categories', ['Uncategorized']] },
                    parutionYear: '$books.parutionYear',
                    pages: '$books.pages',
                    dateAdded: { $ifNull: ['$books.dateAdded', new Date()] },
                    bookboxId: { $toString: '$_id' },
                    bookboxName: '$name'
                }
            },
            
            // Limit to 1 result since we're looking for a specific book
            { $limit: 1 }
        ];

        const results = await BookBox.aggregate(pipeline);
        return results.length > 0 ? results[0] : null;
    },
 
    async requestBookToUsers(request: AuthenticatedRequest & { 
        body: { title: string; customMessage?: string }; 
        query: { latitude?: number; longitude?: number } 
    }) {
        const user = await User.findById(request.user.id);
        if (!user) {
            throw newErr(404, 'User not found');
        }

        const { latitude, longitude } = request.query;
        if (!latitude || !longitude) {
            throw newErr(400, 'User location (latitude and longitude) is required');
        }

        // Get all bookboxes and filter by distance using Haversine formula
        const allBookboxes = await BookBox.find();
        const nearbyBookboxes = allBookboxes.filter(bookbox => {
            if (!bookbox.longitude || !bookbox.latitude) {
                return false;
            }
            
            const distance = this.calculateDistance(latitude, longitude, bookbox.latitude, bookbox.longitude);
            return distance <= user.requestNotificationRadius;
        });

        // Get all unique users who follow any of these nearby bookboxes
        const bookboxIds = nearbyBookboxes.map(bookbox => bookbox._id.toString());
        const usersToNotify = await User.find({
            followedBookboxes: { $in: bookboxIds }
        });

        // Notify all relevant users
        for (let i = 0; i < usersToNotify.length; i++) {
            if (usersToNotify[i].username !== user.username) {
                await notifyUser(usersToNotify[i].id,
                    "Book request",
                    `The user ${user.username} wants to get the book "${request.body.title}" ! If you have it, please feel free to add it to one of our book boxes !`);
            }
        }

        const newRequest = new Request({
            username: user.username,
            bookTitle: request.body.title,
            customMessage: request.body.customMessage,
        });
        await newRequest.save();
        return newRequest;
    },

    async deleteBookRequest(request: { params: { id: string } }) {
        const requestId = request.params.id;
        const requestToDelete = await Request.findById(requestId);
        if (!requestToDelete) {
            throw newErr(404, 'Request not found');
        }
        await requestToDelete.deleteOne();
    },


    async getBookRequests(request: { query: { username?: string } }) {
        let username = request.query.username;
        if (!username) {
            return Request.find();
        } else {
            return Request.find({username: username});
        }
    },

    // Get transaction history
    async getTransactionHistory(request: { query: { username?: string; bookTitle?: string; bookboxId?: string; limit?: number } }) {
        const { username, bookTitle, bookboxId, limit } = request.query;
        
        let filter: any = {};
        if (username) filter.username = username;
        if (bookTitle) filter.bookTitle = new RegExp(bookTitle, 'i');
        if (bookboxId) filter.bookboxId = bookboxId;

        let query = Transaction.find(filter).sort({ timestamp: -1 });
        if (limit) {
            query = query.limit(parseInt(limit.toString()));
        }

        return await query.exec();
    },

    // Create a transaction record
    async createTransaction(username: string, action: 'added' | 'took', bookTitle: string, bookboxId: string) {
        const transaction = new Transaction({
            username,
            action,
            bookTitle,
            bookboxId
        });
        await transaction.save();
        return transaction;
    },

    // Calculate distance between two points using Haversine formula
    calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Radius of the Earth in kilometers
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c; // Distance in kilometers
        return distance;
    },

    // Convert degrees to radians
    deg2rad(deg: number): number {
        return deg * (Math.PI/180);
    }
};

export default bookService;
 