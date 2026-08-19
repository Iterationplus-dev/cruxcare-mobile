package com.cruxcintl.monnify;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.teamapt.monnify.sdk.Monnify;
import com.teamapt.monnify.sdk.MonnifyTransactionResponse;
import com.teamapt.monnify.sdk.Status;
import com.teamapt.monnify.sdk.data.model.TransactionDetails;
import com.teamapt.monnify.sdk.data.model.TransactionType;
import com.teamapt.monnify.sdk.model.PaymentMethod;
import com.teamapt.monnify.sdk.service.ApplicationMode;

import org.json.JSONObject;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Capacitor bridge over Monnify's Android checkout SDK.
 *
 * Monnify launches its own activity via startActivityForResult, so this uses
 * the legacy request-code path that Capacitor documents for exactly that case
 * (@CapacitorPlugin(requestCodes = ...) plus handleOnActivityResult) rather
 * than the AndroidX Activity Result API.
 *
 * The plugin never sees card data - it is entered inside Monnify's activity -
 * and it is deliberately not the authority on whether money moved. It reports
 * what the SDK returned; the CruxCare API decides settlement after verifying
 * the transaction with Monnify server-to-server.
 */
@CapacitorPlugin(name = "Monnify", requestCodes = { MonnifyPlugin.CHARGE_REQUEST_CODE })
public class MonnifyPlugin extends Plugin {

    /** Must stay a compile-time constant - it is read from the annotation above. */
    static final int CHARGE_REQUEST_CODE = 0x4D4E;

    private static final String RESULT_KEY = "com.cruxcintl.monnify.TRANSACTION_RESULT";

    private static final String ERR_NOT_CONFIGURED = "MONNIFY_NOT_CONFIGURED";
    private static final String ERR_INVALID_REQUEST = "MONNIFY_INVALID_REQUEST";
    private static final String ERR_NO_ACTIVITY = "MONNIFY_NO_ACTIVITY";
    private static final String ERR_LAUNCH_FAILED = "MONNIFY_LAUNCH_FAILED";
    private static final String ERR_IN_PROGRESS = "MONNIFY_IN_PROGRESS";

    private boolean configured = false;

    @PluginMethod
    public void configure(PluginCall call) {
        String apiKey = trimmed(call.getString("apiKey"));
        String contractCode = trimmed(call.getString("contractCode"));

        if (apiKey == null || contractCode == null) {
            call.reject("Monnify needs both an API key and a contract code.", ERR_NOT_CONFIGURED);
            return;
        }

        String mode = call.getString("applicationMode", "TEST");
        Monnify monnify = Monnify.Companion.getInstance();
        monnify.setApiKey(apiKey);
        monnify.setContractCode(contractCode);
        monnify.setApplicationMode(
            "LIVE".equalsIgnoreCase(mode) ? ApplicationMode.LIVE : ApplicationMode.TEST
        );

        configured = true;
        call.resolve();
    }

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject result = new JSObject();
        result.put("supported", true);
        result.put("platform", "android");
        result.put("configured", configured);
        call.resolve(result);
    }

    @PluginMethod
    public void charge(PluginCall call) {
        if (!configured) {
            call.reject("Monnify has not been configured yet.", ERR_NOT_CONFIGURED);
            return;
        }

        // Monnify's sheet is a single foreground activity; a second concurrent
        // charge would orphan the first call and could double-charge.
        if (getSavedCall() != null) {
            call.reject("A Monnify payment is already in progress.", ERR_IN_PROGRESS);
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("No activity is available to present Monnify checkout.", ERR_NO_ACTIVITY);
            return;
        }

        Double amount = call.getDouble("amount");
        String currencyCode = trimmed(call.getString("currencyCode"));
        String paymentReference = trimmed(call.getString("paymentReference"));
        String paymentDescription = trimmed(call.getString("paymentDescription"));
        String customerName = trimmed(call.getString("customerName"));
        String customerEmail = trimmed(call.getString("customerEmail"));

        if (amount == null || amount <= 0d) {
            call.reject("A positive amount is required.", ERR_INVALID_REQUEST);
            return;
        }
        if (currencyCode == null || paymentReference == null || customerEmail == null) {
            call.reject(
                "currencyCode, paymentReference and customerEmail are required.",
                ERR_INVALID_REQUEST
            );
            return;
        }

        TransactionDetails.Builder builder = new TransactionDetails.Builder()
            .amount(BigDecimal.valueOf(amount))
            .currencyCode(currencyCode.toUpperCase(Locale.ROOT))
            .paymentReference(paymentReference)
            .paymentDescription(paymentDescription == null ? "" : paymentDescription)
            .customerName(customerName == null ? "" : customerName)
            .customerEmail(customerEmail);

        Map<String, String> metadata = readMetadata(call.getObject("metadata"));
        if (!metadata.isEmpty()) builder.metaData(metadata);

        List<PaymentMethod> methods = readPaymentMethods(call.getArray("paymentMethods"));
        if (!methods.isEmpty()) builder.paymentMethods(methods);

        // The call has to outlive this method - the answer arrives on the
        // activity result once the customer is done with Monnify's sheet.
        call.setKeepAlive(true);
        saveCall(call);

        try {
            Monnify.Companion.getInstance()
                .initializePayment(activity, builder.build(), CHARGE_REQUEST_CODE, RESULT_KEY);
        } catch (Exception e) {
            releaseSavedCall();
            call.reject("Monnify checkout could not be opened.", ERR_LAUNCH_FAILED, e);
        }
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);

        if (requestCode != CHARGE_REQUEST_CODE) return;

        PluginCall call = getSavedCall();
        if (call == null) return;

        MonnifyTransactionResponse response = data == null ? null : readResponse(data);

        // Backing out of the sheet returns RESULT_CANCELED with no payload;
        // that is a cancellation, not a failure, and never a payment.
        call.resolve(response == null ? cancelled(call) : toResult(response));
        releaseSavedCall();
    }

    // ------------------------------------------------------------------
    // Mapping
    // ------------------------------------------------------------------

    private static JSObject cancelled(PluginCall call) {
        MonnifyTransactionResponse empty = new MonnifyTransactionResponse();
        empty.setStatus(Status.CANCELLED);
        empty.setPaymentReference(call.getString("paymentReference"));
        empty.setCurrencyCode(call.getString("currencyCode"));
        empty.setMessage("Payment was cancelled before it completed.");
        return toResult(empty);
    }

    private static JSObject toResult(MonnifyTransactionResponse response) {
        JSObject result = new JSObject();
        Status status = response.getStatus();

        result.put("status", status == null ? Status.PENDING.name() : status.name());
        putNullable(result, "transactionReference", response.getTransactionReference());
        putNullable(result, "paymentReference", response.getPaymentReference());
        putNullable(result, "amountPaid", toDouble(response.getAmountPaid()));
        putNullable(result, "amountPayable", toDouble(response.getAmountPayable()));
        putNullable(result, "currencyCode", response.getCurrencyCode());
        putNullable(result, "paidOn", response.getPaidOn());
        putNullable(result, "message", response.getMessage());

        TransactionType method = response.getPaymentMethod();
        putNullable(result, "paymentMethod", method == null ? null : method.name());

        return result;
    }

    /**
     * A missing value has to reach JavaScript as null. Handing a Java null to
     * JSObject.put(String, String) would drop the key instead, which reads as
     * "not reported" rather than "reported as absent".
     */
    private static void putNullable(JSObject target, String key, Object value) {
        target.put(key, value == null ? JSONObject.NULL : value);
    }

    private static Double toDouble(BigDecimal value) {
        return value == null ? null : value.doubleValue();
    }

    @SuppressWarnings("deprecation")
    private static MonnifyTransactionResponse readResponse(Intent data) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return data.getParcelableExtra(RESULT_KEY, MonnifyTransactionResponse.class);
        }
        return (MonnifyTransactionResponse) data.getParcelableExtra(RESULT_KEY);
    }

    private static Map<String, String> readMetadata(JSObject metadata) {
        Map<String, String> values = new HashMap<>();
        if (metadata == null) return values;

        Iterator<String> keys = metadata.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            Object value = metadata.opt(key);
            if (value != null && value != JSONObject.NULL) values.put(key, String.valueOf(value));
        }
        return values;
    }

    /** Unknown method names are dropped rather than failing the charge. */
    private static List<PaymentMethod> readPaymentMethods(JSArray requested) {
        List<PaymentMethod> methods = new ArrayList<>();
        if (requested == null) return methods;

        for (int i = 0; i < requested.length(); i++) {
            Object value = requested.opt(i);
            if (!(value instanceof String)) continue;
            try {
                methods.add(PaymentMethod.valueOf(((String) value).toUpperCase(Locale.ROOT)));
            } catch (IllegalArgumentException ignored) {
                // Not a method this SDK version offers.
            }
        }
        return methods;
    }

    private void releaseSavedCall() {
        if (getSavedCall() != null) freeSavedCall();
    }

    private static String trimmed(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
