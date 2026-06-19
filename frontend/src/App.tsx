import { useEffect, useMemo, useState } from "react";
import {
    Anchor,
    AppShell,
    Badge,
    Button,
    Container,
    Group,
    Image,
    Loader,
    Modal,
    Paper,
    SimpleGrid,
    Stack,
    Table,
    Text,
    Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconLogin, IconLogout, IconTrash } from "@tabler/icons-react";
import type { User } from "oidc-client-ts";
import { getPost, listAdminPosts, listPosts, removePost } from "./api";
import { getUser, handleLoginCallback, login, logout } from "./auth";
import type { AdminPost, PublicPost } from "./types";
import mostImage from "../assets/most.png";
import recentImage from "../assets/recent.png";
import yarlysImage from "../assets/yarlys.png";
import meekmailImage from "../assets/meekmail.png";

export function App() {
    const path = window.location.pathname;

    if (path === "/admin/callback") {
        return <AdminCallback />;
    }

    if (path === "/admin") {
        return <AdminPage />;
    }

    const detailMatch = path.match(/^\/posts\/([^/]+)$/);
    if (detailMatch?.[1]) {
        return <PostDetail id={decodeURIComponent(detailMatch[1])} />;
    }

    return <PostList />;
}

function Shell({
    children,
    right,
}: {
    children: React.ReactNode;
    right?: React.ReactNode;
}) {
    return (
        <AppShell header={{ height: 64 }} padding="md">
            <AppShell.Header>
                <Container size="lg" h="100%">
                    <Group h="100%" justify="space-between">
                        <Anchor href="/" c="dark" underline="never">
                            <Title order={2}>
                                <Image
                                    src={meekmailImage}
                                    alt="meekmail"
                                    className="title-image"
                                />
                            </Title>
                        </Anchor>
                        {right}
                    </Group>
                </Container>
            </AppShell.Header>
            <AppShell.Main>
                <Container size="lg">{children}</Container>
            </AppShell.Main>
        </AppShell>
    );
}

function PostList() {
    const [posts, setPosts] = useState<PublicPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | undefined>();

    useEffect(() => {
        listPosts()
            .then(setPosts)
            .catch((err: Error) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    return (
        <Shell right={<Anchor href="/admin">Admin</Anchor>}>
            <Stack gap="lg">
                <Title
                    order={1}
                    className="yarly-title"
                    aria-label="yarly most recent"
                >
                    <Group className="title-image-stack" gap="xs">
                        <span className="title-image-frame title-image-frame-yarlys">
                            <Image
                                src={yarlysImage}
                                alt="yarly"
                                className="title-image"
                            />
                        </span>
                        <span className="title-image-frame title-image-frame-most">
                            <Image
                                src={mostImage}
                                alt="most"
                                className="title-image"
                            />
                        </span>
                        <span className="title-image-frame title-image-frame-recent">
                            <Image
                                src={recentImage}
                                alt="recent"
                                className="title-image"
                            />
                        </span>
                    </Group>
                </Title>
                {loading && <Loader />}
                {error && <Text c="red">Could not load posts: {error}</Text>}
                {!loading && posts.length === 0 && (
                    <Text c="dimmed">No posts yet.</Text>
                )}
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    {posts.map((post) => (
                        <Paper key={post.id} p="md" withBorder radius="sm">
                            <Stack gap="sm">
                                {post.images[0] && (
                                    <Image
                                        src={post.images[0].url}
                                        alt=""
                                        radius="sm"
                                        h={220}
                                        fit="cover"
                                    />
                                )}
                                <Anchor
                                    href={`/posts/${encodeURIComponent(post.id)}`}
                                    c="dark"
                                    underline="never"
                                >
                                    <Title order={3}>{post.title}</Title>
                                </Anchor>
                                <Text c="dimmed" size="sm">
                                    {formatDate(post.publishedAt)}
                                </Text>
                                <Text lineClamp={3}>{post.bodyText}</Text>
                            </Stack>
                        </Paper>
                    ))}
                </SimpleGrid>
            </Stack>
        </Shell>
    );
}

function PostDetail({ id }: { id: string }) {
    const [post, setPost] = useState<PublicPost | undefined>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | undefined>();

    useEffect(() => {
        getPost(id)
            .then(setPost)
            .catch((err: Error) => setError(err.message))
            .finally(() => setLoading(false));
    }, [id]);

    return (
        <Shell right={<Anchor href="/">Posts</Anchor>}>
            {loading && <Loader />}
            {error && <Text c="red">Could not load post: {error}</Text>}
            {post && (
                <Stack gap="lg">
                    <Title order={1}>{post.title}</Title>
                    <Text c="dimmed">{formatDate(post.publishedAt)}</Text>
                    {post.bodyHtml ? (
                        <div
                            className="post-html"
                            dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
                        />
                    ) : (
                        <Text className="post-text">{post.bodyText}</Text>
                    )}
                    {post.images.length > 0 && (
                        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                            {post.images.map((image) => (
                                <Image
                                    key={image.id}
                                    src={image.url}
                                    alt={image.filename || ""}
                                    radius="sm"
                                />
                            ))}
                        </SimpleGrid>
                    )}
                </Stack>
            )}
        </Shell>
    );
}

function AdminCallback() {
    const [message, setMessage] = useState("Signing in...");

    useEffect(() => {
        handleLoginCallback()
            .then(() => {
                window.location.replace("/admin");
            })
            .catch((err: Error) => setMessage(`Login failed: ${err.message}`));
    }, []);

    return (
        <Shell>
            <Text>{message}</Text>
        </Shell>
    );
}

function AdminPage() {
    const [user, setUser] = useState<User | null>(null);
    const [posts, setPosts] = useState<AdminPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [removing, setRemoving] = useState<AdminPost | undefined>();

    const token = user?.id_token || user?.access_token;
    const publishedCount = useMemo(
        () => posts.filter((post) => post.status === "PUBLISHED").length,
        [posts],
    );

    useEffect(() => {
        getUser()
            .then((loadedUser) => {
                setUser(loadedUser);
                if (!loadedUser) {
                    setLoading(false);
                    return [];
                }
                return listAdminPosts(
                    loadedUser.id_token || loadedUser.access_token,
                );
            })
            .then((loadedPosts) => {
                if (Array.isArray(loadedPosts)) {
                    setPosts(loadedPosts);
                }
            })
            .catch((err: Error) =>
                notifications.show({ color: "red", message: err.message }),
            )
            .finally(() => setLoading(false));
    }, []);

    async function confirmRemove() {
        if (!removing || !token) {
            return;
        }

        await removePost(removing.message_id, token);
        setPosts((current) =>
            current.map((post) =>
                post.message_id === removing.message_id
                    ? { ...post, status: "REMOVED" }
                    : post,
            ),
        );
        setRemoving(undefined);
        notifications.show({ color: "green", message: "Post removed" });
    }

    if (!user && !loading) {
        return (
            <Shell>
                <Stack gap="md" maw={420}>
                    <Title order={1}>Admin</Title>
                    <Text c="dimmed">Sign in to remove published posts.</Text>
                    <Button
                        leftSection={<IconLogin size={16} />}
                        onClick={() => void login()}
                    >
                        Sign in
                    </Button>
                </Stack>
            </Shell>
        );
    }

    return (
        <Shell
            right={
                <Button
                    variant="subtle"
                    leftSection={<IconLogout size={16} />}
                    onClick={() => void logout()}
                >
                    Sign out
                </Button>
            }
        >
            <Stack gap="lg">
                <Group justify="space-between">
                    <div>
                        <Title order={1}>Admin</Title>
                        <Text c="dimmed">{publishedCount} published posts</Text>
                    </div>
                </Group>
                {loading ? (
                    <Loader />
                ) : (
                    <Paper withBorder radius="sm">
                        <Table.ScrollContainer minWidth={720}>
                            <Table striped highlightOnHover>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>Title</Table.Th>
                                        <Table.Th>Status</Table.Th>
                                        <Table.Th>Published</Table.Th>
                                        <Table.Th />
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {posts.map((post) => (
                                        <Table.Tr key={post.message_id}>
                                            <Table.Td>{post.title}</Table.Td>
                                            <Table.Td>
                                                <Badge
                                                    color={
                                                        post.status ===
                                                        "PUBLISHED"
                                                            ? "green"
                                                            : "gray"
                                                    }
                                                >
                                                    {post.status}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td>
                                                {formatDate(post.published_at)}
                                            </Table.Td>
                                            <Table.Td>
                                                <Button
                                                    size="xs"
                                                    color="red"
                                                    variant="light"
                                                    leftSection={
                                                        <IconTrash size={14} />
                                                    }
                                                    disabled={
                                                        post.status !==
                                                        "PUBLISHED"
                                                    }
                                                    onClick={() =>
                                                        setRemoving(post)
                                                    }
                                                >
                                                    Remove
                                                </Button>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </Table.ScrollContainer>
                    </Paper>
                )}
            </Stack>
            <Modal
                opened={Boolean(removing)}
                onClose={() => setRemoving(undefined)}
                title="Remove post"
                centered
            >
                <Stack>
                    <Text>
                        This hides the post from the public site while keeping
                        the private record.
                    </Text>
                    <Group justify="flex-end">
                        <Button
                            variant="default"
                            onClick={() => setRemoving(undefined)}
                        >
                            Cancel
                        </Button>
                        <Button
                            color="red"
                            onClick={() => void confirmRemove()}
                        >
                            Remove
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </Shell>
    );
}

function formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}
