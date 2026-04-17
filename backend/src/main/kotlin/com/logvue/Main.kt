package com.logvue

import com.logvue.data.parser.AutoDetectParser
import com.logvue.plugins.configureRouting
import com.logvue.service.LogService
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.cio.*
import io.ktor.server.engine.*
import io.ktor.server.http.content.*
import io.ktor.server.plugins.callloging.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.Json

fun main(args: Array<String>) {
    // Direct instantiation (no Koin needed for Stage 1)
    val logParser = AutoDetectParser()
    val logService = LogService(logParser)

    embeddedServer(CIO, port = 8080, host = "0.0.0.0") {
        module(logService)
    }.start(wait = true)
}

fun Application.module(logService: LogService) {
    install(CORS) {
        anyHost()
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Options)
        allowHeader(HttpHeaders.ContentType)
        allowHeader(HttpHeaders.Accept)
        allowHeader(HttpHeaders.Origin)
        allowCredentials = true
        allowNonSimpleContentTypes = true
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

    // Serve static files from classpath (works from JAR and filesystem)
    routing {
        staticResources("/", "files")
    }

    configureRouting(logService)
}