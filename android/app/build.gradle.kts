plugins {
    id("com.android.application")
}

// The app shows the web app from ../ar-tekenen; it is copied into the APK on every build.
val webDir = rootProject.file("../ar-tekenen")
val syncWeb by tasks.registering(Sync::class) {
    from(webDir) {
        exclude("README.md", "sw.js")
    }
    into(layout.buildDirectory.dir("generated/web/www"))
}

android {
    namespace = "nl.artekenen.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "nl.artekenen.app"
        minSdk = 24
        targetSdk = 35
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = "1.0.${System.getenv("GITHUB_RUN_NUMBER") ?: "0"}"
    }

    signingConfigs {
        create("release") {
            storeFile = rootProject.file("keystore/ar-tekenen.jks")
            storePassword = "artekenen"
            keyAlias = "ar-tekenen"
            keyPassword = "artekenen"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            signingConfig = signingConfigs.getByName("release")
        }
    }

    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/web"))

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

tasks.named("preBuild") { dependsOn(syncWeb) }

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.core:core:1.13.1")
}
