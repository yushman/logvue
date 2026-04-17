package com.logvue.data.parser

class AutoDetectParser : LogParser {

    private val androidParser = AndroidLogcatParser()
    private val textLogParser = TextLogParser()
    private val simpleTextLogParser = SimpleTextLogParser()
    private val plainTextLogcatParser = PlainTextLogcatParser()

    override suspend fun parse(bytes: ByteArray, fileName: String): ParseResult {
        val type = PreParser.detect(bytes)
        return when (type) {
            ParserType.ANDROID_JSON -> androidParser.parse(bytes, fileName)
            ParserType.TEXT_LOG_DETAILED -> textLogParser.parse(bytes, fileName)
            ParserType.TEXT_LOG_SIMPLE, ParserType.TEXT_LOG_MONTH_NAME -> simpleTextLogParser.parse(bytes, fileName)
            ParserType.TEXT_LOG_PLAIN -> plainTextLogcatParser.parse(bytes, fileName)
        }
    }
}