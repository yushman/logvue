pluginManagement {
    repositories {
        mavenCentral()
        gradlePluginPortal()
    }
}

rootProject.name = "logvue"

include("backend")

dependencyResolutionManagement {
    repositories {
        mavenCentral()
    }
}