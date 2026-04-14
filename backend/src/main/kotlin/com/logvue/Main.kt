package com.logvue

import com.logvue.data.parser.AndroidLogcatParser
import com.logvue.plugins.configureRouting
import com.logvue.service.LogService
import io.ktor.server.application.*
import io.ktor.server.cio.*
import io.ktor.server.engine.*
import io.ktor.server.plugins.cors.*
import io.ktor.server.plugins.callloging.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.json.Json
import io.ktor.server.http.content.*
import io.ktor.server.routing.*
import java.io.File

fun main(args: Array<String>) {
    // Direct instantiation (no Koin needed for Stage 1)
    val logParser = AndroidLogcatParser()
    val logService = LogService(logParser)

    embeddedServer(CIO, port = 8080, host = "0.0.0.0") {
        module(logService)
    }.start(wait = true)
}

fun Application.module(logService: LogService) {
    install(CORS) {
        anyHost()
        allowHeaders { true }
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Options)
    }

    install(ContentNegotiation) {
        json(Json {
            prettyPrint = true
            isLenient = true
            ignoreUnknownKeys = true
            coerceInputValues = true
        })
    }

    install(CallLogging)

    // Serve static files using routing
    routing {
        staticFiles("/", File("src/main/resources/files"), "index.html")
    }

    configureRouting(logService)
}