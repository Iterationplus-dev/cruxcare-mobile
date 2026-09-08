# Monnify's own AAR ships keep rules for com.teamapt.monnify.sdk.**; these cover
# the bridge classes Capacitor reaches reflectively plus the Retrofit/Gson models
# the SDK deserializes into.
-keep public class com.cruxcintl.monnify.** { *; }
-keepattributes Signature, InnerClasses, EnclosingMethod, *Annotation*
-dontwarn okhttp3.**
-dontwarn retrofit2.**
