import ConfirmRemove from "@/components/training/ConfirmRemove";

export default function RemoveUploadedSession({ id }: { id: string }) {
  return <ConfirmRemove endpoint="/api/session/training-data" body={{ action: "delete_session", id }} question="Remove this session?" />;
}
