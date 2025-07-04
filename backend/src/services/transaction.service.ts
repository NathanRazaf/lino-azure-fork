import Transaction from '../models/transaction.model';

interface CreateCustomTransactionParams {
    username: string;
    action: 'added' | 'took';
    bookTitle: string;
    bookboxId: string;
    day: string; // Format: AAAA-MM-DD
    hour: string; // Format: HH:MM
}

class TransactionService {
    static async createCustomTransaction(params: CreateCustomTransactionParams) {
        const { username, action, bookTitle, bookboxId, day, hour } = params;
        
        // Validate day format (AAAA-MM-DD)
        const dayRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dayRegex.test(day)) {
            throw new Error('Day must be in format AAAA-MM-DD');
        }
        
        // Validate hour format (HH:MM)
        const hourRegex = /^\d{2}:\d{2}$/;
        if (!hourRegex.test(hour)) {
            throw new Error('Hour must be in format HH:MM');
        }
        
        // Build timestamp from day and hour
        const timestampString = `${day}T${hour}:00.000Z`;
        const timestamp = new Date(timestampString);
        
        // Validate that the constructed date is valid
        if (isNaN(timestamp.getTime())) {
            throw new Error('Invalid date/time combination');
        }
        
        // Create the transaction
        const transaction = new Transaction({
            username,
            action,
            bookTitle,
            bookboxId,
            timestamp
        });
        
        const savedTransaction = await transaction.save();
        return savedTransaction;
    }
}

export default TransactionService;
