"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const thread_model_1 = __importDefault(require("../models/thread.model"));
const user_service_1 = __importStar(require("./user.service"));
const user_model_1 = __importDefault(require("../models/user.model"));
const book_service_1 = __importDefault(require("./book.service"));
const utilities_1 = require("./utilities");
const ThreadService = {
    createThread(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const username = yield user_service_1.default.getUserName(request.user.id);
            if (!username) {
                throw (0, utilities_1.newErr)(401, 'Unauthorized');
            }
            const { bookId, title } = request.body;
            const book = yield book_service_1.default.getBook(bookId);
            if (!book) {
                throw (0, utilities_1.newErr)(404, 'Book not found');
            }
            if (!title) {
                throw (0, utilities_1.newErr)(400, 'Title is required');
            }
            const bookTitle = book.title;
            const thread = new thread_model_1.default({
                bookTitle: bookTitle,
                username: username,
                title: title,
                image: book.coverImage,
                messages: []
            });
            yield thread.save();
            return thread;
        });
    },
    deleteThread(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const threadId = request.params.threadId;
            const thread = yield thread_model_1.default.findById(threadId);
            if (!thread) {
                throw (0, utilities_1.newErr)(404, 'Thread not found');
            }
            yield thread.deleteOne();
        });
    },
    addThreadMessage(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const username = yield user_service_1.default.getUserName(request.user.id);
            if (!username) {
                throw (0, utilities_1.newErr)(401, 'Unauthorized');
            }
            const { content, respondsTo } = request.body;
            const threadId = request.body.threadId;
            const thread = yield thread_model_1.default.findById(threadId);
            if (!thread) {
                throw (0, utilities_1.newErr)(404, 'Thread not found');
            }
            const message = {
                username: username,
                content: content,
                respondsTo: respondsTo,
                reactions: []
            };
            thread.messages.push(message);
            yield thread.save();
            // Notify the user that someone has responded to their message
            if (respondsTo != null) {
                const parentMessage = thread.messages.id(respondsTo);
                if (!parentMessage) {
                    throw (0, utilities_1.newErr)(404, 'Parent message not found');
                }
                if (parentMessage.username !== username) {
                    const userParent = yield user_model_1.default.findOne({ username: parentMessage.username });
                    if (!userParent) {
                        throw (0, utilities_1.newErr)(404, 'User not found');
                    }
                    yield (0, user_service_1.notifyUser)(userParent.id, `${username} in ${thread.title}`, message.content);
                }
            }
            // Get the _id of the newly created message
            const messageId = thread.messages[thread.messages.length - 1].id;
            return { messageId };
        });
    },
    toggleMessageReaction(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const username = yield user_service_1.default.getUserName(request.user.id);
            if (!username) {
                throw (0, utilities_1.newErr)(401, 'Unauthorized');
            }
            const { reactIcon, messageId, threadId } = request.body;
            // Find the thread that contains the message
            const thread = yield thread_model_1.default.findById(threadId);
            if (!thread) {
                throw (0, utilities_1.newErr)(404, 'Thread not found');
            }
            // Find the message
            const message = thread.messages.id(messageId);
            if (!message) {
                throw (0, utilities_1.newErr)(404, 'Message not found');
            }
            // Check if the user has already reacted to this message with the same icon
            if (message.reactions.find(r => r.username === username && r.reactIcon === reactIcon)) {
                // Remove the reaction
                message.reactions = message.reactions.filter(r => r.username !== username || r.reactIcon !== reactIcon);
            }
            else {
                // Add the reaction
                message.reactions.push({ username: username, reactIcon: reactIcon, timestamp: new Date() });
            }
            yield thread.save();
            if (message.reactions.length > 0) {
                return message.reactions[message.reactions.length - 1];
            }
            else {
                return null;
            }
        });
    },
    searchThreads(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = request.query.q;
            let threads = yield thread_model_1.default.find();
            if (query) {
                // Filter using regex for more flexibility
                const regex = new RegExp(query, 'i');
                threads = threads.filter(thread => regex.test(thread.bookTitle) || regex.test(thread.title) || regex.test(thread.username));
            }
            // classify : ['by recent activity', 'by number of messages', 'by creation date']
            let classify = request.query.cls || 'by recent activity';
            const asc = request.query.asc; // Boolean
            if (classify === 'by recent activity') {
                threads.sort((a, b) => {
                    const aDate = a.messages.length > 0 ? a.messages[a.messages.length - 1].timestamp.getTime() : 0;
                    const bDate = b.messages.length > 0 ? b.messages[b.messages.length - 1].timestamp.getTime() : 0;
                    return asc ? aDate - bDate : bDate - aDate;
                });
            }
            else if (classify === 'by number of messages') {
                threads.sort((a, b) => {
                    return asc ? a.messages.length - b.messages.length : b.messages.length - a.messages.length;
                });
            }
            else if (classify === 'by creation date') {
                threads.sort((a, b) => {
                    const aDate = a.timestamp.getTime();
                    const bDate = b.timestamp.getTime();
                    return asc ? aDate - bDate : bDate - aDate;
                });
            }
            return { threads: threads };
        });
    },
    clearCollection() {
        return __awaiter(this, void 0, void 0, function* () {
            yield thread_model_1.default.deleteMany({});
        });
    }
};
exports.default = ThreadService;
