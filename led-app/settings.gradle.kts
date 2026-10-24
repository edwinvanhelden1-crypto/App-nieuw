val onlyTuya = System.getenv("ONLY_TUYA") != null

pluginManagement {
    repositories {
        // Optioneel een spiegel van Maven Central (handig achter een proxy met limieten).
        System.getenv("MAVEN_MIRROR")?.let { maven(it) }
        mavenCentral()
        gradlePluginPortal()
        if (System.getenv("ONLY_TUYA") == null) google()
    }
    plugins {
        id("com.android.application") version "8.7.3"
        id("org.jetbrains.kotlin.android") version "2.0.21"
        id("org.jetbrains.kotlin.jvm") version "2.0.21"
        id("org.jetbrains.kotlin.plugin.compose") version "2.0.21"
        id("org.jetbrains.kotlin.plugin.serialization") version "2.0.21"
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        System.getenv("MAVEN_MIRROR")?.let { maven(it) }
        mavenCentral()
        if (!onlyTuya) google()
    }
}

rootProject.name = "LedBediening"
include(":tuya")
// Zonder Android SDK (bijv. om alleen de protocoltests te draaien): ONLY_TUYA=1 gradle :tuya:test
if (!onlyTuya) include(":app")
