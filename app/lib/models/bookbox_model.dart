import 'book_model.dart';

class BookBox {
  final String name;
  final double longitude;
  final double latitude;
  final String? infoText;
  final List<Book> books;

  BookBox({
    required this.name,
    required this.longitude,
    required this.latitude,
    this.infoText,
    required this.books,
  });

  factory BookBox.fromJson(Map<String, dynamic> json) {
    var booksList = json['books'] as List;
    List<Book> books = booksList.map((bookJson) => Book.fromJson(bookJson)).toList();

    return BookBox(
      name: json['name'],
      longitude: (json['longitude'] as num).toDouble(),
      latitude: (json['latitude'] as num).toDouble(),
      infoText: json['infoText'],
      books: books,
    );
  }
}
