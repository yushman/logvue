package com.logvue.plugins

import com.logvue.data.model.FilterRequest
import com.logvue.service.LogService
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Application.configureRouting(logService: LogService) {
    routing {
        get("/health") {
            call.respond(mapOf("status" to "ok"))
        }

        route("/api") {
            route("/logs") {
                post("/upload") {
                    val multipart = call.receiveMultipart()
                    var fileBytes: ByteArray? = null
                    var fileName = "unknown"

                    multipart.forEachPart { part: PartData ->
                        when (part) {
                            is PartData.FileItem -> {
                                fileName = part.originalFileName ?: "unknown"
                                val inputStream = part.streamProvider()
                                fileBytes = inputStream.readBytes()
                            }

                            else -> {}
                        }
                        part.dispose()
                    }

                    val bytes = fileBytes
                    if (bytes != null) {
                        val result = logService.uploadLogFile(bytes, fileName)
                        call.respond(result)
                    } else {
                        call.respond(HttpStatusCode.BadRequest, "No file uploaded")
                    }
                }

                post("/filter") {
                    val request = call.receive<FilterRequest>()
                    val result = logService.filterLogs(request)
                    call.respond(result)
                }
            }
        }
    }
}