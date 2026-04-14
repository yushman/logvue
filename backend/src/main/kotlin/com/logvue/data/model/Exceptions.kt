package com.logvue.data.model

class FileTooLargeException(val actualSize: Long, val maxSize: Long) : Exception(
    "File size ${actualSize} bytes exceeds maximum allowed size of ${maxSize} bytes"
)

class MalformedJsonException(override val message: String) : Exception(message)
