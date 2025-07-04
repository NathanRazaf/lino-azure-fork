class Transaction {
  final String username;
  final String action;
  final String bookTitle;
  final String bookboxId;
  final DateTime timestamp;
  final String? bookboxName; // Optional field for bookbox name

  Transaction({
    required this.username,
    required this.action,
    required this.bookTitle,
    required this.bookboxId,
    required this.timestamp,
    this.bookboxName,
  });

  factory Transaction.fromJson(Map<String, dynamic> json) {
    return Transaction(
      username: json['username'] ?? '',
      action: json['action'] ?? '',
      bookTitle: json['bookTitle'] ?? '',
      bookboxId: json['bookboxId'] ?? '',
      timestamp: DateTime.parse(json['timestamp'] ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'username': username,
      'action': action,
      'bookTitle': bookTitle,
      'bookboxId': bookboxId,
      'timestamp': timestamp.toIso8601String(),
    };
  }

  String get actionDisplayText {
    switch (action.toLowerCase()) {
      case 'added':
        return 'Added';
      case 'took':
        return 'Took';
      default:
        return action;
    }
  }

  String get timeAgo {
    final now = DateTime.now();
    final difference = now.difference(timestamp);
    
    if (difference.inDays > 0) {
      return '${difference.inDays}d ago';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h ago';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m ago';
    } else {
      return 'Just now';
    }
  }

  // Create a copy of the transaction with bookbox name
  Transaction copyWith({String? bookboxName}) {
    return Transaction(
      username: username,
      action: action,
      bookTitle: bookTitle,
      bookboxId: bookboxId,
      timestamp: timestamp,
      bookboxName: bookboxName ?? this.bookboxName,
    );
  }
}
