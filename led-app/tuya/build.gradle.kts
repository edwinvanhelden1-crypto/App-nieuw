plugins {
    id("org.jetbrains.kotlin.jvm")
    id("org.jetbrains.kotlin.plugin.serialization")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) }
}

dependencies {
    api("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
    // Tests tegen een nagebootste strip (tools/fake_device.py) draaien alleen als die er is.
    environment("FAKE_DEVICE_PYTHON", System.getenv("FAKE_DEVICE_PYTHON") ?: "")
    testLogging { events("passed", "failed", "skipped"); showStandardStreams = true }
}
