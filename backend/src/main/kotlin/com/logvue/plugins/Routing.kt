package com.logvue.plugins

import com.logvue.data.model.FileTooLargeException
import com.logvue.data.model.FilterRequest
import com.logvue.data.model.MalformedJsonException
import com.logvue.data.model.TimelineRequest
import com.logvue.service.LogService
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import kotlinx.serialization.SerializationException

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
                        try {
                            val result = logService.uploadLogFile(bytes, fileName)
                            call.respond(result)
                        } catch (e: FileTooLargeException) {
                            call.respond(
                                HttpStatusCode.PayloadTooLarge,
                                mapOf("error" to e.message!!, "actualSize" to e.actualSize, "maxSize" to e.maxSize)
                            )
                        } catch (e: MalformedJsonException) {
                            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Malformed JSON: ${e.message}"))
                        } catch (e: SerializationException) {
                            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Malformed JSON: ${e.message}"))
                        }
                    } else {
                        call.respond(HttpStatusCode.BadRequest, "No file uploaded")
                    }
                }

                post("/filter") {
                    val request = call.receive<FilterRequest>()
                    val result = logService.filterLogs(request)
                    call.respond(result)
                }

                get("/timeline") {
                    val fileId = call.request.queryParameters["fileId"]
                        ?: return@get call.respond(HttpStatusCode.BadRequest, "fileId required")
                    val numBucketsStr = call.request.queryParameters["numBuckets"]
                    val numBuckets = numBucketsStr?.toIntOrNull()
                    val timeFromStr = call.request.queryParameters["timeFrom"]
                    val timeFrom = timeFromStr?.toLongOrNull()
                    val timeToStr = call.request.queryParameters["timeTo"]
                    val timeTo = timeToStr?.toLongOrNull()
                    val result = logService.getTimeline(TimelineRequest(fileId, numBuckets, timeFrom, timeTo))
                    call.respond(result)
                }

                get("/entry") {
                    val fileId = call.request.queryParameters["fileId"]
                        ?: return@get call.respond(HttpStatusCode.BadRequest, "fileId required")
                    val entryIdStr = call.request.queryParameters["entryId"]
                        ?: return@get call.respond(HttpStatusCode.BadRequest, "entryId required")
                    val entryId = entryIdStr.toIntOrNull()
                        ?: return@get call.respond(HttpStatusCode.BadRequest, "entryId must be an integer")
                    val entry = logService.getEntry(fileId, entryId)
                    if (entry != null) {
                        call.respond(entry)
                    } else {
                        call.respond(HttpStatusCode.NotFound, mapOf("error" to "Entry not found"))
                    }
                }

                get("/metadata") {
                    val fileId = call.request.queryParameters["fileId"]
                        ?: return@get call.respond(HttpStatusCode.BadRequest, "fileId required")
                    val tagColors = logService.getMetadata(fileId)
                    if (tagColors != null) {
                        call.respond(mapOf("tagColors" to tagColors))
                    } else {
                        call.respond(HttpStatusCode.NotFound, mapOf("error" to "File not found"))
                    }
                }
            }
        }
    }
}
