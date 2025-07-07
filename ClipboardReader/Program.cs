using System;
using System.IO;
using System.Windows.Forms;

class Program {
    [STAThread]
    public static void Main() {
        try {
            string html = Clipboard.GetText(TextDataFormat.Html);
            if (string.IsNullOrEmpty(html)) {
                Console.WriteLine("No HTML content in clipboard.");
                Environment.Exit(1); // Error
            }

            using (var sr = new StringReader(html)) {
                string line;
                while ((line = sr.ReadLine()) != null) {
                    if (line.StartsWith("SourceURL:")) {
                        Console.WriteLine(line.Substring("SourceURL:".Length));
                        Environment.Exit(0); // Success
                    }
                }
            }

            Console.WriteLine("SourceURL not found.");
            Environment.Exit(1); // Error
        } catch (Exception ex) {
            Console.Error.WriteLine("Error: " + ex.Message);
            Environment.Exit(1); // Error
        }
    }
}
