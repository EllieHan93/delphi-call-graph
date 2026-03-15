"""Tests for the Delphi tokenizer (comment/string handling)."""

from backend.parser.tokenizer import clean_source, mask_strings, strip_comments


class TestStripComments:
    def test_line_comment(self):
        src = "x := 1; // this is a comment\ny := 2;"
        result = strip_comments(src)
        assert "this is a comment" not in result
        assert "x := 1;" in result
        assert "y := 2;" in result

    def test_brace_comment(self):
        src = "x := 1; {inline comment} y := 2;"
        result = strip_comments(src)
        assert "inline comment" not in result
        assert "x := 1;" in result
        assert "y := 2;" in result

    def test_brace_comment_multiline(self):
        src = "x := 1;\n{multi\nline\ncomment}\ny := 2;"
        result = strip_comments(src)
        assert "multi" not in result
        assert "y := 2;" in result
        # Newlines preserved
        assert result.count("\n") == src.count("\n")

    def test_paren_star_comment(self):
        src = "x := 1; (* block *) y := 2;"
        result = strip_comments(src)
        assert "block" not in result
        assert "x := 1;" in result
        assert "y := 2;" in result

    def test_paren_star_multiline(self):
        src = "a;\n(* multi\nline *)\nb;"
        result = strip_comments(src)
        assert "multi" not in result
        assert result.count("\n") == src.count("\n")

    def test_string_preserved(self):
        src = "s := 'this is not // a comment';"
        result = strip_comments(src)
        assert "'this is not // a comment'" in result

    def test_string_with_braces(self):
        src = "s := 'text {not a comment} here';"
        result = strip_comments(src)
        assert "'text {not a comment} here'" in result

    def test_escaped_quote_in_string(self):
        src = "s := 'it''s working';"
        result = strip_comments(src)
        assert "it''s working" in result

    def test_mixed_comments(self):
        src = (
            "procedure Foo; // line comment\n"
            "begin\n"
            "  { block } x := 1;\n"
            "  (* another *) y := 2;\n"
            "end;\n"
        )
        result = strip_comments(src)
        assert "line comment" not in result
        assert "block" not in result
        assert "another" not in result
        assert "procedure Foo;" in result
        assert "x := 1;" in result
        assert "y := 2;" in result

    def test_compiler_directive_stripped(self):
        """Compiler directives like {$R *.dfm} are inside braces and get stripped."""
        src = "{$R *.dfm}\nprocedure Foo;"
        result = strip_comments(src)
        assert "$R" not in result
        assert "procedure Foo;" in result


class TestMaskStrings:
    def test_simple_string(self):
        src = "s := 'hello world';"
        result = mask_strings(src)
        assert "hello" not in result
        assert "'___________'" in result

    def test_empty_string(self):
        src = "s := '';"
        result = mask_strings(src)
        assert "''" in result

    def test_escaped_quote(self):
        src = "s := 'it''s';"
        result = mask_strings(src)
        assert "it" not in result


class TestCleanSource:
    def test_full_pipeline(self):
        src = (
            "procedure Foo; // comment\n"
            "begin\n"
            "  s := 'hello';\n"
            "  { block }\n"
            "end;\n"
        )
        result = clean_source(src)
        assert "comment" not in result
        assert "block" not in result
        assert "hello" not in result
        assert "procedure Foo;" in result
        assert "'_____'" in result
