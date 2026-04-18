package parser

// AutoDetectParser dispatches to the correct parser based on PreParser.detect()
type AutoDetectParser struct {
	androidParser     *AndroidLogcatParser
	textLogParser     *TextLogParser
	simpleTextParser  *SimpleTextLogParser
	plainTextParser   *PlainTextLogcatParser
}

// NewAutoDetectParser creates a new auto-detecting parser
func NewAutoDetectParser() *AutoDetectParser {
	return &AutoDetectParser{
		androidParser:    NewAndroidLogcatParser(),
		textLogParser:    NewTextLogParser(),
		simpleTextParser: NewSimpleTextLogParser(),
		plainTextParser:  NewPlainTextLogcatParser(),
	}
}

// Parse determines the format and delegates to the appropriate parser
func (p *AutoDetectParser) Parse(bytes []byte, fileName string) (*ParseResult, error) {
	logType := DetectLogType(bytes)

	switch logType {
	case LogTypeAndroidJSON:
		return p.androidParser.Parse(bytes, fileName)
	case LogTypeTextLogDetailed:
		return p.textLogParser.Parse(bytes, fileName)
	case LogTypeTextLogSimple, LogTypeTextLogMonthName:
		return p.simpleTextParser.Parse(bytes, fileName)
	case LogTypeTextLogPlain:
		return p.plainTextParser.Parse(bytes, fileName)
	default:
		// Fallback: try Android JSON first, then plain
		if result, err := p.androidParser.Parse(bytes, fileName); err == nil {
			return result, nil
		}
		return p.plainTextParser.Parse(bytes, fileName)
	}
}
